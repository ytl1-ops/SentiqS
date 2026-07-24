// React Hook for managing real-time alerts
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertFilter, AlertStats, WebSocketMessage } from './alert-types';
import { AlertService } from './alert-service';

const SOCKET_URL = process.env.EXPO_PUBLIC_SENTINEL_ALERTS_URL || 'http://localhost:3001';

export function useAlerts(userId: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!userId) return;

    const connectSocket = () => {
      try {
        const socket = io(SOCKET_URL, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
          query: { userId },
          transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
          console.log('✅ Alerts WebSocket connected');
          setConnected(true);
          setError(null);
          // Fetch initial alerts
          fetchAlerts();
          fetchStats();
        });

        socket.on('disconnect', () => {
          console.log('❌ Alerts WebSocket disconnected');
          setConnected(false);
        });

        // Handle new alerts
        socket.on('ALERT_NEW', (message: WebSocketMessage) => {
          console.log('🚨 New alert received:', message.data);
          setAlerts(prev => [message.data, ...prev]);
          
          // Show notification for critical alerts
          if (message.data.severity === 'CRITIQUE') {
            triggerCriticalNotification(message.data);
          }
        });

        // Handle alert updates
        socket.on('ALERT_UPDATE', (message: WebSocketMessage) => {
          setAlerts(prev =>
            prev.map(a => a.id === message.data.id ? message.data : a)
          );
        });

        // Handle stats updates
        socket.on('STATS_UPDATE', (message: WebSocketMessage) => {
          setStats(message.data);
        });

        socket.on('error', (err: any) => {
          console.error('WebSocket error:', err);
          setError(err?.message || 'Connection error');
        });

        socketRef.current = socket;
      } catch (err) {
        console.error('Failed to connect to alerts:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
        // Retry connection after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSocket();
        }, 5000);
      }
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [userId]);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async (filter?: AlertFilter) => {
    try {
      setLoading(true);
      const data = await AlertService.fetchAlerts(filter);
      setAlerts(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const data = await AlertService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const updated = await AlertService.acknowledgeAlert(alertId, userId);
      setAlerts(prev => prev.map(a => a.id === alertId ? updated : a));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to acknowledge');
    }
  }, [userId]);

  // Resolve alert
  const resolveAlert = useCallback(async (alertId: string, notes?: string) => {
    try {
      const updated = await AlertService.resolveAlert(alertId, userId, notes);
      setAlerts(prev => prev.map(a => a.id === alertId ? updated : a));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    }
  }, [userId]);

  // Escalate alert
  const escalateAlert = useCallback(async (alertId: string, reason: string) => {
    try {
      const updated = await AlertService.escalateAlert(alertId, userId, reason);
      setAlerts(prev => prev.map(a => a.id === alertId ? updated : a));
    } catch (err) {
      console.error('Failed to escalate alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to escalate');
    }
  }, [userId]);

  // Assign alert
  const assignAlert = useCallback(async (alertId: string, assigneeId: string) => {
    try {
      const updated = await AlertService.assignAlert(alertId, assigneeId);
      setAlerts(prev => prev.map(a => a.id === alertId ? updated : a));
    } catch (err) {
      console.error('Failed to assign alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign');
    }
  }, []);

  return {
    alerts,
    stats,
    loading,
    error,
    connected,
    fetchAlerts,
    fetchStats,
    acknowledgeAlert,
    resolveAlert,
    escalateAlert,
    assignAlert,
  };
}

// Helper function to trigger critical notifications
async function triggerCriticalNotification(alert: Alert) {
  try {
    // This will be implemented in the mobile app layer
    // For web, use browser notifications API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚨 ${alert.severity} - ${alert.title}`, {
        body: alert.description,
        icon: '🚨',
        badge: '🚨',
      });
    }
  } catch (err) {
    console.error('Failed to trigger notification:', err);
  }
}
