# SentiqS Public API & Integrations ⭐

## Overview

Complete REST API for third-party integrations + built-in connectors for Slack, Jira, Salesforce, and more.

### Features

✅ **Public REST API** - Authenticated with API keys  
✅ **Slack Integration** - Post alerts to channels with formatting  
✅ **Jira Integration** - Auto-create security tickets  
✅ **Generic Webhooks** - POST alerts to any endpoint  
✅ **Google Sheets** - Append alerts to spreadsheets  
✅ **Rate Limiting** - Per API key, configurable  
✅ **Audit Trail** - All API calls logged  

## Quick Start

### 1. Create API Key

```bash
curl -X POST http://localhost:3000/api/v1/keys \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App",
    "permissions": ["alerts:read", "stats:read"]
  }'

# Response:
# {
#   "id": "key_123",
#   "key": "sk_abc123...",  # Save this securely!
#   "name": "Mobile App",
#   "rateLimit": 100
# }
```

### 2. Use API Key

```bash
curl -H "Authorization: Bearer sk_abc123..." \
  https://api.sentiqs.com/v1/alerts?country=Mali&severity=CRITIQUE
```

## API Endpoints

### Alerts

#### List Alerts

```http
GET /api/v1/alerts?limit=50&offset=0&country=Mali&severity=CRITIQUE
```

**Query Parameters:**
- `limit` (1-100, default 50)
- `offset` (default 0)
- `country` (filter by country)
- `severity` (CRITIQUE, ÉLEVÉ, MODÉRÉ, STABLE)

**Response:**

```json
{
  "data": [
    {
      "id": "alert_123",
      "country": "Mali",
      "title": "Affrontements signalés à Gao",
      "description": "Incident sécuritaire près de la frontière",
      "severity": "CRITIQUE",
      "category": "SÉCURITÉ",
      "createdAt": "2026-07-24T14:30:00Z",
      "source": "RSS"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

#### Create Alert

```http
POST /api/v1/alerts
Content-Type: application/json

{
  "title": "Nouveaux incidents",
  "description": "Description de l'incident",
  "country": "Senegal",
  "severity": "ÉLEVÉ",
  "category": "POLITIQUE",
  "sourceUrl": "https://..."
}
```

### Statistics

#### Get Stats

```http
GET /api/v1/stats
```

**Response:**

```json
{
  "total": 47,
  "critical": 3,
  "elevated": 8,
  "moderate": 15,
  "stable": 21,
  "byCountry": {
    "Mali": 5,
    "Kenya": 3,
    "Senegal": 2
  },
  "timestamp": "2026-07-24T14:35:00Z"
}
```

### Correlations

#### Get Correlations

```http
GET /api/v1/correlations?hours=24
```

**Response:**

```json
{
  "correlations": [
    {
      "category": "POLITIQUE",
      "countries": ["Mali", "Burkina Faso", "Niger"],
      "count": 12
    },
    {
      "category": "ÉCONOMIE",
      "countries": ["Kenya", "Tanzania"],
      "count": 5
    }
  ],
  "timeWindow": "Last 24h"
}
```

## Integrations

### Slack

**Setup:**

1. Create Slack App at https://api.slack.com/apps
2. Add "chat:write" scope
3. Get bot token (xoxb-...)

**Configure:**

```bash
curl -X POST http://localhost:3000/api/v1/integrations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SLACK",
    "name": "Security Alerts",
    "config": {
      "botToken": "xoxb-...",
      "channelId": "C1234567890",
      "mentionChannelOnCritical": true,
      "alertSeverityFilter": ["CRITIQUE", "ÉLEVÉ"]
    }
  }'
```

**Result:** Alerts posted to Slack channel with severity color coding

### Jira

**Setup:**

1. Create API token at https://id.atlassian.com/manage-profile/security/api-tokens
2. Note your Jira domain (acme.atlassian.net)

**Configure:**

```bash
curl -X POST http://localhost:3000/api/v1/integrations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "JIRA",
    "name": "Security Tickets",
    "config": {
      "domain": "acme.atlassian.net",
      "email": "you@acme.com",
      "apiToken": "...",
      "projectKey": "SEC",
      "issueType": "Security Alert",
      "autoCreateOnSeverity": ["CRITIQUE", "ÉLEVÉ"],
      "assigneeId": "user_123"
    }
  }'
```

**Result:** Critical/elevated alerts auto-create Jira tickets

### Generic Webhooks

**Configure:**

```bash
curl -X POST http://localhost:3000/api/v1/integrations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "WEBHOOK",
    "name": "Custom System",
    "config": {
      "url": "https://your-system.com/alerts",
      "method": "POST",
      "authType": "BEARER",
      "authValue": "your_token",
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  }'
```

**Payload sent:**

```json
{
  "id": "alert_123",
  "country": "Mali",
  "title": "Affrontements signalés",
  "severity": "CRITIQUE",
  "category": "SÉCURITÉ",
  "createdAt": "2026-07-24T14:30:00Z",
  "timestamp": "2026-07-24T14:30:00Z"
}
```

## Rate Limiting

Default: **100 requests/minute per API key**

Headers:
- `X-RateLimit-Limit`: 100
- `X-RateLimit-Remaining`: 95
- `X-RateLimit-Reset`: 1690200600

**Exceeded?**

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

## Error Codes

| Code | Message |
|------|----------|
| 401 | Unauthorized (invalid/missing API key) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 429 | Too many requests (rate limited) |
| 500 | Server error |

## Examples

### JavaScript/Node.js

```javascript
const apiKey = 'sk_abc123...';

// Get alerts
const alerts = await fetch('https://api.sentiqs.com/v1/alerts', {
  headers: { Authorization: `Bearer ${apiKey}` },
}).then(r => r.json());

// Create alert
await fetch('https://api.sentiqs.com/v1/alerts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    title: 'New incident',
    country: 'Mali',
    severity: 'ÉLEVÉ',
  }),
});
```

### Python

```python
import requests

api_key = 'sk_abc123...'
headers = {'Authorization': f'Bearer {api_key}'}

# Get stats
stats = requests.get('https://api.sentiqs.com/v1/stats', headers=headers).json()
print(f"Critical alerts: {stats['critical']}")

# Create alert
requests.post('https://api.sentiqs.com/v1/alerts',
  headers={**headers, 'Content-Type': 'application/json'},
  json={
    'title': 'New incident',
    'country': 'Senegal',
    'severity': 'CRITIQUE',
  }
)
```

## Roadmap

- [ ] Microsoft Teams integration
- [ ] ServiceNow integration
- [ ] Datadog integration
- [ ] Custom field mapping UI
- [ ] Bulk alert creation endpoint
- [ ] Alert filtering by tags
- [ ] Webhook signature verification

## Support

Email: api-support@sentiqs.com
