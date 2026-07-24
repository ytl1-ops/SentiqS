# SentiqS Automated Reports ⭐

## Overview

Schedule and generate security intelligence reports in multiple formats (Word, PDF, Excel, CSV).

### Features

✅ **Multiple Formats** - DOCX, PDF, XLSX, CSV  
✅ **Scheduled Generation** - Daily, Weekly, Monthly  
✅ **Email Delivery** - Automatic distribution to teams  
✅ **Customizable Filters** - By country, severity, category  
✅ **Report Types** - Executive, Operational, Full Analysis, Risk Matrix  
✅ **Correlations** - Multi-country threat themes  
✅ **Audit Trail** - Track all generated reports  

## Quick Start

### 1. Create Scheduled Report

```bash
curl -X POST http://localhost:3000/api/v1/reports/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Security Briefing",
    "type": "EXECUTIVE_SUMMARY",
    "format": ["PDF", "XLSX"],
    "frequency": "DAILY",
    "time": "07:00",
    "recipients": ["ceo@acme.com", "ciso@acme.com"],
    "filters": {
      "severities": ["CRITIQUE", "ÉLEVÉ"],
      "regions": ["Sahel", "Golfe de Guinée"]
    }
  }'
```

**Response:**
```json
{
  "id": "schedule_123",
  "name": "Daily Security Briefing",
  "nextGenerationAt": "2026-07-25T07:00:00Z"
}
```

### 2. Generate On-Demand

```bash
curl -X POST http://localhost:3000/api/v1/reports/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OPERATIONAL",
    "format": ["PDF", "DOCX"],
    "filters": {
      "countries": ["Mali", "Burkina Faso"],
      "dateFrom": "2026-07-24T00:00:00Z",
      "dateTo": "2026-07-24T23:59:59Z"
    }
  }'
```

## Report Types

### Executive Summary

**Best for:** C-level executives, board meetings

**Includes:**
- 📊 Alert statistics (by severity, region)
- 🔴 Critical incidents summary
- 📍 Geographic hotspots
- 📈 Trends (last 7 days)
- ⚠️ Top 5 escalated alerts

**Typical length:** 2-3 pages

### Operational Report

**Best for:** Security operations centers, incident management

**Includes:**
- ✅ All active alerts (tabular format)
- 🔄 Status breakdown (acknowledged, unacknowledged, escalated)
- 📋 Assignment matrix (who's handling what)
- ⏱️ Response times (avg, min, max)
- 🔗 Alert correlations

**Typical length:** 5-10 pages

### Full Analysis

**Best for:** Detailed investigations, risk assessments

**Includes:**
- 📍 Country risk profiles
- 🔍 Incident root cause analysis
- 📊 Multi-year trends
- 🗺️ Regional threat patterns
- 💡 Recommendations

**Typical length:** 15-20 pages

### Risk Matrix

**Best for:** Risk committees, compliance audits

**Includes:**
- 📌 Risk scoring (likelihood × impact)
- 📋 Compliance checklist
- ⚠️ Gaps identified
- 🎯 Mitigation strategies
- 📅 Implementation timeline

**Typical length:** 8-12 pages

## Scheduling Options

| Frequency | Timing | Example |
|-----------|--------|----------|
| **DAILY** | Any time (HH:mm) | 07:00 = 7 AM daily |
| **WEEKLY** | Monday at HH:mm | 09:00 = Monday 9 AM |
| **MONTHLY** | 1st of month at HH:mm | 14:00 = 1st of month 2 PM |

## Report Formats

### DOCX (Word)
**Use when:** Sharing with non-technical teams, easy editing needed  
**Size:** ~500 KB  
**Compatible:** Microsoft Word, Google Docs, LibreOffice

### PDF
**Use when:** Email distribution, archiving, formal reports  
**Size:** ~2 MB  
**Feature:** Read-only, embedded images

### XLSX (Excel)
**Use when:** Data analysis, dashboards, SQL integration  
**Size:** ~100 KB  
**Feature:** Multiple sheets, formulas, charts

### CSV
**Use when:** System integration, data imports  
**Size:** ~50 KB  
**Feature:** Plain text, universal compatibility

## Customization

### Filter by Country

```json
{
  "filters": {
    "countries": ["Mali", "Senegal", "Burkina Faso"]
  }
}
```

### Filter by Region

```json
{
  "filters": {
    "regions": ["Sahel", "Corne de l'Afrique"]
  }
}
```

### Filter by Severity

```json
{
  "filters": {
    "severities": ["CRITIQUE", "ÉLEVÉ"]
  }
}
```

### Filter by Date Range

```json
{
  "filters": {
    "dateFrom": "2026-07-01T00:00:00Z",
    "dateTo": "2026-07-31T23:59:59Z"
  }
}
```

### Combine Filters

```json
{
  "filters": {
    "countries": ["Mali"],
    "severities": ["CRITIQUE"],
    "categories": ["SÉCURITÉ"],
    "dateFrom": "2026-07-24T00:00:00Z",
    "dateTo": "2026-07-24T23:59:59Z"
  }
}
```

## Email Configuration

**Required environment variables:**

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxx
SMTP_FROM=reports@sentiqs.com
```

## API Endpoints

### List Schedules

```http
GET /api/v1/reports/schedules
```

### Create Schedule

```http
POST /api/v1/reports/schedule
Content-Type: application/json
```

### Update Schedule

```http
PUT /api/v1/reports/schedule/{id}
```

### Delete Schedule

```http
DELETE /api/v1/reports/schedule/{id}
```

### Generate Report

```http
POST /api/v1/reports/generate
```

**Response:** File download (appropriate MIME type)

## Examples

### Python: Download Report

```python
import requests
from datetime import datetime

token = 'sk_abc123...'
headers = {'Authorization': f'Bearer {token}'}

response = requests.post(
    'https://api.sentiqs.com/v1/reports/generate',
    headers=headers,
    json={
        'type': 'EXECUTIVE_SUMMARY',
        'format': ['PDF'],
        'filters': {'countries': ['Mali']}
    }
)

with open(f'report_{datetime.now():%Y%m%d}.pdf', 'wb') as f:
    f.write(response.content)
```

### JavaScript: Schedule Weekly Report

```javascript
const response = await fetch('https://api.sentiqs.com/v1/reports/schedule', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Weekly Briefing',
    type: 'EXECUTIVE_SUMMARY',
    format: ['PDF', 'XLSX'],
    frequency: 'WEEKLY',
    time: '09:00',
    recipients: ['team@acme.com'],
    filters: {
      severities: ['CRITIQUE', 'ÉLEVÉ'],
    },
  }),
});

const result = await response.json();
console.log('Report scheduled:', result.id);
```

## Troubleshooting

### Reports not sending

1. Check SMTP credentials in `.env`
2. Verify email addresses are valid
3. Check logs: `docker logs sentiqs-reports`

### PDF generation fails

Install system fonts:
```bash
apt-get install fontconfig fonts-liberation
```

### Schedule not running

```bash
# Check if scheduler is initialized
curl http://localhost:3000/health
# Should show: {"status": "ok"}
```

## Roadmap

- [ ] Report templates (custom branding)
- [ ] Multi-language support (AR, FR, EN, PT)
- [ ] Dashboard embedding
- [ ] Real-time report preview
- [ ] Report signing (digital signature)
- [ ] Archive retention policies
- [ ] Report versioning

## Support

Email: reports@sentiqs.com
