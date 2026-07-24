# SentiqS Real-Time Alerts System ⭐

## Overview

Complete real-time alert infrastructure with WebSocket support, multi-level escalation, and automated notifications.

### Features

✅ **Real-time WebSockets** - Push alerts instantly to connected clients  
✅ **Multi-level Escalation** - Auto-escalate unacknowledged alerts (0 → 1 → 2 → 3)  
✅ **Alert Routing** - Smart routing based on user rules, severity, and role  
✅ **Multi-channel Notifications** - Email, SMS, Push, Webhooks, In-app  
✅ **Job Queue** - Bull + Redis for reliable async processing  
✅ **Offline Support** - Local queue on mobile, sync on reconnect  
✅ **Audit Trail** - Full history of escalations and acknowledgements  

## Architecture

```
┌─ Alert Service (Backend) ─────────────────┐
│ • Alert ingestion (RSS, API, manual)       │
│ • Qualification & severity scoring         │
│ • Stores in Supabase PostgreSQL            │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌─ Alert Server (Node.js/Socket.io) ────────┐
│ • WebSocket connections                    │
│ • Real-time broadcasting                   │
│ • User routing & filtering                 │
└────────────────┬─────────────────────────┘
                 │
         ┌───────┼───────┐
         ▼       ▼       ▼
    ┌────────────────────────┐
    │ Job Queues (Bull)      │
    ├────────────────────────┤
    │ • Alert Queue          │
    │ • Notification Queue   │
    │ • Escalation Queue     │
    └────────────────────────┘
                 │
         ┌───────┴───────┬───────────┐
         ▼               ▼           ▼
    ┌──────────┐  ┌────────────┐  ┌─────────┐
    │ Email    │  │ SMS        │  │ Push    │
    │ (SendGrid)│ │ (Twilio)   │  │(Firebase)│
    └──────────┘  └────────────┘  └─────────┘
```

## Installation

### Backend Setup

```bash
cd backend/alerts
npm install
```

**Dependencies:**
```bash
npm install express socket.io redis bull @supabase/supabase-js dotenv
```

### Environment Variables

Create `.env` in `backend/alerts/`:

```env
# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://ytl1-ops.github.io/SentiqS

# Redis
REDIS_URL=redis://localhost:6379

# Supabase
SUPABASE_URL=https://zpdwqmliogxbuwirziny.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Notifications
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
FIREBASE_PROJECT_ID=...
```

### Start Server

```bash
node alert-server.js
# Or with hot reload:
npm install -D nodemon
nodemon alert-server.js
```

## Frontend Integration

### React Hook Usage

```tsx
import { useAlerts } from '@/lib/alerts/use-alerts';

export function AlertDashboard({ userId }) {
  const {
    alerts,
    stats,
    loading,
    connected,
    acknowledgeAlert,
    escalateAlert,
    resolveAlert,
  } = useAlerts(userId);

  return (
    <div>
      <div className="status">
        {connected ? '✅ Connected' : '❌ Offline'}
      </div>
      
      <div className="stats">
        🔴 Critical: {stats?.critical || 0}
        🟠 Elevated: {stats?.elevated || 0}
        🟡 Moderate: {stats?.moderate || 0}
      </div>

      <div className="alerts">
        {alerts.map(alert => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={() => acknowledgeAlert(alert.id)}
            onEscalate={(reason) => escalateAlert(alert.id, reason)}
            onResolve={(notes) => resolveAlert(alert.id, notes)}
          />
        ))}
      </div>
    </div>
  );
}
```

## API Examples

### Broadcast New Alert

```bash
curl -X POST http://localhost:3001/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Affrontements signalés à la frontière",
    "description": "Incident sécuritaire à Gao, Mali",
    "country": "Mali",
    "severity": "CRITIQUE",
    "category": "SÉCURITÉ",
    "channels": ["PUSH", "EMAIL", "WEBHOOK"],
    "priority": 95
  }'
```

### Escalation Flow (Auto)

```
1. Alert created (status: ACTIVE, escalationLevel: 0)
   ↓ [30 min timeout]
2. Auto-escalate if unacknowledged → escalationLevel: 1
   → Notify all MANAGER users
   ↓ [30 min timeout]
3. Auto-escalate → escalationLevel: 2
   → Notify all DIRECTOR users
   ↓ [30 min timeout]
4. Auto-escalate → escalationLevel: 3 (MAX)
   → Notify CEO & ADMIN users
```

### WebSocket Events

**Client → Server:**
```javascript
socket.emit('ALERT_ACKNOWLEDGE', { alertId: '123' });
socket.emit('ALERT_RESOLVE', { alertId: '123', notes: 'Incident resolved' });
socket.emit('ALERT_ESCALATE', { alertId: '123', reason: 'No response from team' });
socket.emit('PING', {});
```

**Server → Client:**
```javascript
socket.on('ALERT_NEW', (message) => { /* New alert */ });
socket.on('ALERT_UPDATE', (message) => { /* Alert changed */ });
socket.on('ALERT_ESCALATED', (message) => { /* Alert escalated */ });
socket.on('STATS_UPDATE', (message) => { /* Stats refresh */ });
socket.on('PONG', (message) => { /* Keep-alive response */ });
```

## Database Schema

### alerts table

```sql
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  country text not null,
  region text,
  title text not null,
  description text,
  severity text check (severity in ('CRITIQUE', 'ÉLEVÉ', 'MODÉRÉ', 'STABLE')),
  category text check (category in ('SÉCURITÉ', 'HUMANITAIRE', 'POLITIQUE', 'ÉCONOMIE')),
  status text default 'ACTIVE' check (status in ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED')),
  priority int,
  channels text[],
  tags text[],
  assigned_to uuid,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  escalation_level int default 0,
  next_escalation_at timestamptz,
  created_at timestamptz default now(),
  detected_at timestamptz,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  enabled boolean default true,
  condition jsonb, -- {"severity": [...], "countries": [...], ...}
  actions jsonb,   -- {"channels": [...], "escalateAfter": 30, ...}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on alerts(user_id, status, created_at desc);
create index on alerts(assigned_to, status);
create index on alerts(escalation_level) where escalation_level > 0;
```

## Performance Considerations

- **Redis Caching**: Alert stats cached for 5 minutes
- **Connection Pooling**: Node.js maintains persistent WebSocket connections
- **Job Retry**: Failed notifications retry up to 3 times
- **Dead Letter Queue**: Failed jobs after 3 retries moved to DLQ for inspection
- **Memory**: Alert queue limited to 10K pending items

## Troubleshooting

### WebSocket Connection Fails

```bash
# Check if server is running
curl http://localhost:3001/health

# Check Redis connection
redis-cli ping
# Expected: PONG
```

### Alerts Not Appearing

1. Verify user is connected: `userConnections.has(userId)`
2. Check alert rules are enabled
3. Inspect job queue: `alertQueue.getJobs(['waiting'])`
4. Check Supabase row-level security policies

### Memory Leak

```bash
# Monitor Redis memory
redis-cli info memory

# Clear old jobs
node -e "require('bull')('alerts', 'redis://localhost:6379').clean(86400000)"
```

## Roadmap

- [ ] Machine learning for alert priority prediction
- [ ] Anomaly detection for repeated alerts
- [ ] SMS two-factor acknowledgement
- [ ] Slack integration
- [ ] Custom alert templates
- [ ] Alert suppression rules
- [ ] Performance metrics dashboard

## License

MIT
