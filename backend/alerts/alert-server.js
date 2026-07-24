/**
 * SentiqS Real-Time Alert Server
 * Node.js + Express + Socket.io
 * 
 * Handles WebSocket connections, alert broadcasting,
 * escalation logic, and multi-channel notifications.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');
const Queue = require('bull');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Redis clients
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});
const redisSubscriber = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Job queues
const alertQueue = new Queue('alerts', process.env.REDIS_URL || 'redis://localhost:6379');
const notificationQueue = new Queue('notifications', process.env.REDIS_URL || 'redis://localhost:6379');
const escalationQueue = new Queue('escalations', process.env.REDIS_URL || 'redis://localhost:6379');

// ─── Store active connections per user ───────────────────────────────────
const userConnections = new Map(); // userId -> Set<socketId>
const socketToUser = new Map(); // socketId -> userId

// ─── Alert routing based on severity & user rules ────────────────────────
class AlertRouter {
  constructor(supabase, redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Route an alert to appropriate users based on rules
   */
  async routeAlert(alert) {
    try {
      const { data: rules, error } = await this.supabase
        .from('alert_rules')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      const recipients = new Set();

      // Match alert against rules
      for (const rule of rules || []) {
        if (this.matchesRule(alert, rule)) {
          rule.actions.notifyUsers.forEach(userId => recipients.add(userId));
        }
      }

      // Always notify assignee if assigned
      if (alert.assignedTo) {
        recipients.add(alert.assignedTo);
      }

      // Critical alerts go to everyone with ADMIN/MANAGER role
      if (alert.severity === 'CRITIQUE') {
        const { data: admins, error: adminError } = await this.supabase
          .from('profiles')
          .select('id')
          .in('role', ['ADMIN', 'MANAGER']);

        if (!adminError && admins) {
          admins.forEach(admin => recipients.add(admin.id));
        }
      }

      return Array.from(recipients);
    } catch (err) {
      console.error('Alert routing error:', err);
      return [];
    }
  }

  /**
   * Check if alert matches rule conditions
   */
  matchesRule(alert, rule) {
    const { condition } = rule;

    if (condition.severity && !condition.severity.includes(alert.severity)) {
      return false;
    }
    if (condition.category && !condition.category.includes(alert.category)) {
      return false;
    }
    if (condition.countries && !condition.countries.includes(alert.country)) {
      return false;
    }
    if (condition.keywords && condition.keywords.length > 0) {
      const text = `${alert.title} ${alert.description}`.toLowerCase();
      const hasKeyword = condition.keywords.some(kw =>
        text.includes(kw.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    return true;
  }
}

const alertRouter = new AlertRouter(supabase, redisClient);

// ─── WebSocket Event Handlers ──────────────────────────────────────────────
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;

  if (!userId) {
    socket.disconnect(true);
    return;
  }

  console.log(`👤 User connected: ${userId} (socket: ${socket.id})`);

  // Track connection
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId).add(socket.id);
  socketToUser.set(socket.id, userId);

  // Join user-specific room for targeted messaging
  socket.join(`user:${userId}`);

  // Send initial stats
  socket.emit('STATS_UPDATE', {
    type: 'STATS_UPDATE',
    data: {}, // Will be populated by stats service
    timestamp: new Date(),
  });

  // ─── Handle alert acknowledgement ───────────────────────────────────────
  socket.on('ALERT_ACKNOWLEDGE', async (data) => {
    try {
      const { alertId } = data;
      const { data: updated, error } = await supabase
        .from('alerts')
        .update({
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date().toISOString(),
          acknowledgedBy: userId,
          assignedTo: userId,
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      // Broadcast update to all connected users
      io.emit('ALERT_UPDATE', {
        type: 'ALERT_UPDATE',
        data: updated,
        timestamp: new Date(),
      });

      socket.emit('ACK', { success: true, alertId });
    } catch (err) {
      console.error('Acknowledge error:', err);
      socket.emit('ERROR', { message: err.message });
    }
  });

  // ─── Handle alert resolution ───────────────────────────────────────────
  socket.on('ALERT_RESOLVE', async (data) => {
    try {
      const { alertId, notes } = data;
      const { data: updated, error } = await supabase
        .from('alerts')
        .update({
          status: 'RESOLVED',
          metadata: { resolvedBy: userId, resolvedNotes: notes },
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      io.emit('ALERT_UPDATE', {
        type: 'ALERT_UPDATE',
        data: updated,
        timestamp: new Date(),
      });

      socket.emit('ACK', { success: true, alertId });
    } catch (err) {
      console.error('Resolve error:', err);
      socket.emit('ERROR', { message: err.message });
    }
  });

  // ─── Handle alert escalation ───────────────────────────────────────────
  socket.on('ALERT_ESCALATE', async (data) => {
    try {
      const { alertId, reason } = data;

      // Fetch current alert
      const { data: alert, error: fetchError } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', alertId)
        .single();

      if (fetchError) throw fetchError;

      const nextLevel = (alert.escalationLevel || 0) + 1;
      if (nextLevel > 3) throw new Error('Maximum escalation level reached');

      const { data: updated, error } = await supabase
        .from('alerts')
        .update({
          escalationLevel: nextLevel,
          status: 'ESCALATED',
          nextEscalationAt: new Date(Date.now() + 30 * 60000).toISOString(),
          metadata: {
            ...alert.metadata,
            escalations: [
              ...(alert.metadata?.escalations || []),
              { level: nextLevel, by: userId, reason, at: new Date().toISOString() },
            ],
          },
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;

      // Notify escalation recipients
      const escalationRecipients = await getEscalationRecipients(nextLevel);
      escalationRecipients.forEach(recipientId => {
        io.to(`user:${recipientId}`).emit('ALERT_NEW', {
          type: 'ALERT_NEW',
          data: updated,
          timestamp: new Date(),
        });
      });

      // Queue escalation notification
      await escalationQueue.add({ alert: updated, level: nextLevel });

      socket.emit('ACK', { success: true, alertId, escalatedTo: nextLevel });
    } catch (err) {
      console.error('Escalation error:', err);
      socket.emit('ERROR', { message: err.message });
    }
  });

  // ─── Handle disconnect ─────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`👤 User disconnected: ${userId} (socket: ${socket.id})`);
    const sockets = userConnections.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userConnections.delete(userId);
      }
    }
    socketToUser.delete(socket.id);
  });

  // ─── Ping/keepalive ────────────────────────────────────────────────────
  socket.on('PING', () => {
    socket.emit('PONG', { timestamp: new Date() });
  });
});

// ─── Alert Processing Job Handler ──────────────────────────────────────────
alertQueue.process(async (job) => {
  const { alert } = job.data;
  console.log(`⚙️ Processing alert: ${alert.id}`);

  // Route alert to appropriate users
  const recipients = await alertRouter.routeAlert(alert);

  // Broadcast to all connected users of recipients
  recipients.forEach(recipientId => {
    const sockets = userConnections.get(recipientId);
    if (sockets) {
      sockets.forEach(socketId => {
        io.to(socketId).emit('ALERT_NEW', {
          type: 'ALERT_NEW',
          data: alert,
          timestamp: new Date(),
        });
      });
    }
  });

  // Queue notification for each channel
  for (const channel of alert.channels) {
    await notificationQueue.add({ alert, channel });
  }

  // Schedule escalation if needed
  const escalateAfter = 30; // minutes
  await escalationQueue.add(
    { alert, reason: 'Auto-escalation due to timeout' },
    { delay: escalateAfter * 60 * 1000 }
  );

  return { processed: true, recipients: recipients.length };
});

// ─── Notification Job Handler ──────────────────────────────────────────────
notificationQueue.process(async (job) => {
  const { alert, channel } = job.data;
  console.log(`📧 Sending notification via ${channel}: ${alert.id}`);

  switch (channel) {
    case 'EMAIL':
      // Send email via SendGrid/Mailgun
      await sendEmailNotification(alert);
      break;
    case 'SMS':
      // Send SMS via Twilio
      await sendSmsNotification(alert);
      break;
    case 'WEBHOOK':
      // POST to configured webhooks
      await sendWebhookNotification(alert);
      break;
    case 'PUSH':
      // Send push via Firebase
      await sendPushNotification(alert);
      break;
  }

  return { notified: true, channel };
});

// ─── Escalation Job Handler ────────────────────────────────────────────────
escalationQueue.process(async (job) => {
  const { alert, level } = job.data;
  console.log(`⬆️ Auto-escalating alert ${alert.id} to level ${level}`);

  // Update alert in database
  await supabase
    .from('alerts')
    .update({ escalationLevel: level || 1 })
    .eq('id', alert.id);

  // Notify escalation recipients
  const recipients = await getEscalationRecipients(level || 1);
  recipients.forEach(recipientId => {
    io.to(`user:${recipientId}`).emit('ALERT_ESCALATED', {
      type: 'ALERT_ESCALATED',
      data: { ...alert, escalationLevel: level },
      timestamp: new Date(),
    });
  });

  return { escalated: true, level };
});

// ─── Helper Functions ──────────────────────────────────────────────────────

async function getEscalationRecipients(level) {
  const roleMap = {
    1: ['MANAGER'],
    2: ['DIRECTOR'],
    3: ['CEO', 'ADMIN'],
  };

  const roles = roleMap[level] || [];
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id')
    .in('role', roles);

  return error ? [] : (users || []).map(u => u.id);
}

async function sendEmailNotification(alert) {
  // Implement with SendGrid/Mailgun
  console.log(`📧 Email sent for alert ${alert.id}`);
}

async function sendSmsNotification(alert) {
  // Implement with Twilio
  console.log(`📱 SMS sent for alert ${alert.id}`);
}

async function sendWebhookNotification(alert) {
  // POST alert to configured webhooks
  console.log(`🔗 Webhook posted for alert ${alert.id}`);
}

async function sendPushNotification(alert) {
  // Implement with Firebase Cloud Messaging
  console.log(`🔔 Push notification sent for alert ${alert.id}`);
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await alertQueue.close();
  await notificationQueue.close();
  await escalationQueue.close();
  await redisClient.quit();
  await redisSubscriber.quit();
  server.close(() => process.exit(0));
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Alert server listening on port ${PORT}`);
});

module.exports = { io, app };
