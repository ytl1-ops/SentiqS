# SentiqS v2.0 - 4 Enterprise Skills Deployed ✅

## 🚀 DEPLOYMENT GUIDE

### Prerequisites

```bash
# Node.js 18+
node --version

# npm 9+
npm --version

# Redis (for queues)
redis-server --version
```

---

## 1️⃣ SETUP BACKEND

### A) Alert Server (Real-Time WebSockets)

```bash
cd backend/alerts

# Install dependencies
npm install express socket.io redis bull @supabase/supabase-js dotenv

# Configure .env
cp .env.example .env
# Edit .env with your credentials:
# - REDIS_URL
# - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# - SMTP credentials
# - PORT (default 3001)

# Start server
node alert-server.js
# ✅ Should log: "🚀 Alert server listening on port 3001"
```

### B) Report Scheduler (Cron Jobs)

```bash
cd backend/reports

# Install dependencies
npm install node-cron nodemailer docx jspdf exceljs

# Configure SMTP (in .env)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxx
SMTP_FROM=reports@sentiqs.com

# Start scheduler
ts-node report-scheduler.ts
# ✅ Should log: "🎉 Initializing report scheduler..."
```

### C) Database Setup (Supabase)

```bash
# Run migration
supabase db push --file-path supabase/migrations/20260724_alerts_schema.sql

# ✅ Tables created:
# - alerts
# - alert_rules
# - alert_audit_log
# - alert_notifications
```

---

## 2️⃣ SETUP FRONTEND

### A) Web Dashboard (React)

```bash
cd web/dashboard

# Install dependencies
npm install recharts react-map-gl mapbox-gl

# Configure .env.local
REACT_APP_MAPBOX_TOKEN=pk_live_xxx
REACT_APP_ALERT_SERVER_URL=http://localhost:3001

# Start dev server
npm run dev
# ✅ Open http://localhost:3000
```

### B) Mobile App (React Native / Expo)

```bash
cd app/sentinel-app

# Install Expo CLI
npm install -g expo-cli

# Install dependencies
npm install

# Start Expo
expo start

# Scan QR code with Expo Go app
# ✅ Should show alerts in real-time
```

---

## 3️⃣ ENVIRONMENT VARIABLES

### Create `.env` in project root:

```env
# ===== REDIS =====
REDIS_URL=redis://localhost:6379

# ===== SUPABASE =====
SUPABASE_URL=https://zpdwqmliogxbuwirziny.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
EXPO_PUBLIC_SUPABASE_URL=https://zpdwqmliogxbuwirziny.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# ===== EMAIL (SMTP) =====
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.your_sendgrid_key
SMTP_FROM=reports@sentiqs.com

# ===== MAPS =====
REACT_APP_MAPBOX_TOKEN=pk_live_your_mapbox_token

# ===== API SERVER =====
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://ytl1-ops.github.io/SentiqS

# ===== INTEGRATIONS (Optional) =====
SLACK_BOT_TOKEN=xoxb-your-slack-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
JIRA_DOMAIN=your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your_jira_token
```

---

## 4️⃣ TEST EACH SKILL

### ✅ Skill #1: Real-Time Alerts

```bash
# Terminal 1: Start Alert Server
cd backend/alerts && node alert-server.js

# Terminal 2: Create test alert
curl -X POST http://localhost:3001/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert",
    "country": "Mali",
    "severity": "CRITIQUE",
    "channels": ["PUSH", "EMAIL"]
  }'

# ✅ Check:
# - WebSocket clients receive alert <500ms
# - Alert stored in Supabase
# - Audit log created
```

### ✅ Skill #2: API + Integrations

```bash
# Get API stats
curl http://localhost:3000/api/v1/stats \
  -H "Authorization: Bearer sk_test_key"

# Create alert via API
curl -X POST http://localhost:3000/api/v1/alerts \
  -H "Authorization: Bearer sk_test_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test",
    "country": "Senegal",
    "severity": "ÉLEVÉ"
  }'

# Get correlations
curl http://localhost:3000/api/v1/correlations?hours=24 \
  -H "Authorization: Bearer sk_test_key"

# ✅ Check: All endpoints return 200 + JSON data
```

### ✅ Skill #3: Automated Reports

```bash
# Check if scheduler is running
ps aux | grep report-scheduler

# Manually trigger report generation
node -e "require('./backend/reports/report-service').ReportService.generateReport(
  'user_123',
  'EXECUTIVE_SUMMARY',
  { countries: ['Mali'] },
  ['PDF', 'XLSX']
)"

# Check email (SendGrid)
sendgrid_api_stats  # or check SendGrid dashboard

# ✅ Check: PDF + Excel files generated + email sent
```

### ✅ Skill #4: Intelligent Dashboard

```bash
# Open browser
open http://localhost:3000

# Or via Expo (mobile)
expo start  # Scan QR code

# ✅ Check:
# - Risk Map loads (Mapbox)
# - Severity Gauge shows data
# - Timeline updates in real-time
# - Trend chart renders
# - Key metrics display
```

---

## 5️⃣ PRODUCTION DEPLOYMENT

### Deploy Backend (Heroku / Railway / Render)

```bash
# Heroku
heroku login
heroku create sentiqs-alerts
git push heroku feature/real-time-alerts:main

# Set environment variables
heroku config:set REDIS_URL=...
heroku config:set SUPABASE_URL=...

# Check logs
heroku logs --tail
```

### Deploy Frontend (GitHub Pages / Vercel)

```bash
# GitHub Pages
cd web/dashboard
npm run build
npm run deploy  # Deploys to gh-pages branch

# Vercel
vercel --prod

# Result: https://sentiqs.vercel.app
```

### Deploy Mobile (Expo / App Store / Google Play)

```bash
# Build for iOS
expo build --platform ios

# Build for Android
expo build --platform android

# Submit to stores
expo submit --platform ios --path ./ios-build.ipa
```

---

## 6️⃣ MONITORING & LOGS

```bash
# Alert Server Health
curl http://localhost:3001/health
# Expected: {"status": "ok"}

# Check Redis
redis-cli PING
# Expected: PONG

# Check Supabase connection
supabase status

# View logs
tail -f /var/log/sentiqs-alerts.log
tail -f /var/log/sentiqs-reports.log
```

---

## 7️⃣ TROUBLESHOOTING

### WebSocket Connection Failed
```bash
# Check if alert server is running
lsof -i :3001

# Check CORS settings
# In alert-server.js:
# cors: { origin: 'http://localhost:3000' }
```

### Reports Not Sending
```bash
# Check SMTP credentials
node -e "require('nodemailer').createTransport({...}).verify()"

# Check job queue
redis-cli keys "bull:*"
```

### Dashboard Not Loading Data
```bash
# Check WebSocket connection
console.log(connected);  // Should be true

# Check API key validity
curl http://localhost:3000/api/v1/alerts \
  -H "Authorization: Bearer YOUR_KEY"
```

---

## 📊 ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────┐
│  Frontend (React + React Native)                │
│  ├─ Dashboard (Intelligent UI)                  │
│  ├─ Mobile App (Expo)                          │
│  └─ WebSocket Connection (auto-reconnect)      │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Alert Server (Node.js + Socket.io)             │
│  ├─ WebSocket Broadcast                         │
│  ├─ Alert Routing                              │
│  └─ Connection Management                       │
└────────────────┬────────────────────────────────┘
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
┌─────────┐ ┌────────┐ ┌──────────┐
│ Redis   │ │Supabase│ │ Job      │
│(Queue)  │ │(Data)  │ │ Queues   │
└─────────┘ └────────┘ └──────────┘
     │           │           │
     └───────────┼───────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│  Background Jobs (Bull)                         │
│  ├─ Alert Processing                           │
│  ├─ Notification Delivery                      │
│  ├─ Escalation Logic                           │
│  └─ Report Generation                          │
└─────────────────────────────────────────────────┘
```

---

## 📞 SUPPORT

- **Alerts:** alert-support@sentiqs.com
- **API:** api-support@sentiqs.com
- **Reports:** reports@sentiqs.com
- **Dashboard:** dashboard@sentiqs.com

---

**Version:** 2.0 (4 Enterprise Skills)  
**Last Updated:** 2026-07-24  
**Status:** ✅ Production Ready
