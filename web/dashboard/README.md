# SentiqS Intelligent Dashboard ⭐

## Overview

Real-time, interactive dashboard for security situational awareness across Africa.

### Features

🗺️ **Risk Map** - Choropleth visualization of alert density by country  
📊 **Severity Gauge** - Pie chart of alert distribution  
⏱️ **Timeline** - Chronological incidents with color-coded severity  
📈 **Trend Chart** - Alert volume over last 7 days  
🔗 **Correlations** - Multi-country threat themes  
📍 **Key Metrics** - Critical count, coverage, connection status  
♻️ **Real-time Sync** - WebSocket updates (no page refresh needed)  

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ React Component (IntelligentDashboard)                         │
├─────────────────────────────────────────────────────────────────┤
│ useAlerts Hook                                                  │
│ ├─ WebSocket connection (Socket.io)                            │
│ ├─ Real-time state updates (alerts, stats)                     │
│ └─ Auto-reconnect on disconnect                                │
├─────────────────────────────────────────────────────────────────┤
│ Sub-components:                                                 │
│ ├─ RiskMap (Mapbox GL)                                         │
│ ├─ SeverityGauge (Recharts Pie)                                │
│ ├─ TimelineView (Chronological list)                           │
│ ├─ TrendChart (Recharts Line)                                  │
│ ├─ CorrelationsGraph (Multi-country themes)                    │
│ └─ KeyMetrics (Summary cards)                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### Dependencies

```bash
npm install recharts react-map-gl mapbox-gl
```

### Environment Variables

```env
REACT_APP_MAPBOX_TOKEN=pk_live_xxx
EXPO_PUBLIC_SENTINEL_ALERTS_URL=http://localhost:3001
```

## Usage

### Import Dashboard

```tsx
import { IntelligentDashboard } from '@/web/dashboard/intelligent-dashboard';

export function App({ userId }) {
  return <IntelligentDashboard userId={userId} />;
}
```

## Components

### 1. Risk Map 🗺️

**Purpose:** Geographic overview of alert distribution  
**Data:** Country alert counts + coordinates  
**Interaction:** Click marker to see details

**Features:**
- Marker size = alert count
- Marker color = severity level
- Zoom/pan controls
- Popup details on click

### 2. Severity Gauge 📊

**Purpose:** Quick distribution snapshot  
**Data:** Alert counts by severity (CRITIQUE, ÉLEVÉ, MODÉRÉ, STABLE)

**Display:**
- Pie chart (60% of pie = 60% of alerts are CRITIQUE)
- Legend with color coding
- Hover tooltip

### 3. Timeline ⏱️

**Purpose:** Chronological incident log  
**Data:** Last 24 hours of incidents

**Shows:**
- Title, country, time
- Severity badge (colored dot)
- Scrollable list (max 10 visible)

### 4. Trend Chart 📈

**Purpose:** Alert volume trend analysis  
**Data:** Daily alert counts (last 7 days)

**Features:**
- Line graph with dots
- Date labels on X-axis
- Hover tooltip showing exact count
- Helps identify escalating situations

### 5. Correlations 🔗

**Purpose:** Identify regional patterns  
**Algorithm:**
1. Group alerts by category (SÉCURITÉ, POLITIQUE, etc.)
2. Count unique countries per category
3. Filter: only show if 2+ countries
4. Sort by alert count (descending)
5. Display top 5

**Example:**
```
#POLITIQUE: Mali, Burkina Faso, Niger (12 alerts)
#SÉCURITÉ: Kenya, Tanzania, Uganda (8 alerts)
#ÉCONOMIE: Senegal, Ivory Coast (5 alerts)
```

### 6. Key Metrics 📍

**Cards displayed:**
- 🔴 Critical count
- 🟠 Elevated count
- 📍 Countries covered
- ✅ Connection status (Live/Offline)

**Trends:** Show ↑↓→ if metric changed significantly

## Real-Time Updates

Dashboard auto-updates via WebSocket:

```
Server broadcasts
    ↓
  Socket.io
    ↓
useAlerts hook (re-render)
    ↓
Component state update
    ↓
Charts redraw (animated)
```

**No page refresh needed** — users see alerts within 2-3 seconds of creation.

## Styling

**Color scheme:**
- 🔴 CRITIQUE: `#DC2626` (red)
- 🟠 ÉLEVÉ: `#F97316` (orange)
- 🟡 MODÉRÉ: `#EAB308` (yellow)
- 🟢 STABLE: `#22C55E` (green)

**Layout:**
- Responsive grid (mobile: 1 col, tablet: 2 col, desktop: 3+ col)
- Dark theme (SentiqS brand colors)
- Tailwind CSS utilities

## Performance Optimization

### Memoization

```tsx
const MemoizedRiskMap = React.memo(RiskMap);
```

### Data Limits

- Timeline shows max 10 items (scrollable)
- Correlations show top 5 only
- Trend chart: last 7 days only
- All charts render <100 data points

### Debouncing

```tsx
const handleViewportChange = debounce((viewport) => {
  setViewport(viewport);
}, 200);
```

## Customization

### Add Country Filter

```tsx
const [selectedCountries, setSelectedCountries] = useState([]);

const filtered = alerts.filter(a =>
  selectedCountries.length === 0 || selectedCountries.includes(a.country)
);

<CorrelationsGraph alerts={filtered} />
```

### Add Date Range Picker

```tsx
import DatePicker from 'react-datepicker';

const [dateRange, setDateRange] = useState({
  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  end: new Date(),
});

const filtered = alerts.filter(a => {
  const date = new Date(a.createdAt);
  return date >= dateRange.start && date <= dateRange.end;
});
```

### Export Data

```tsx
function exportDashboard() {
  const data = {
    timestamp: new Date().toISOString(),
    stats,
    alerts: alerts.map(a => ({
      id: a.id,
      country: a.country,
      severity: a.severity,
      title: a.title,
    })),
  };
  
  download(JSON.stringify(data, null, 2), 'dashboard.json');
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive)

## Roadmap

- [ ] Heatmap overlay on map
- [ ] Animated alert flow
- [ ] Predictive scoring model
- [ ] Custom dashboard themes
- [ ] Anomaly detection highlighter
- [ ] Forecast chart (next 30 days)
- [ ] Export to PDF (full dashboard screenshot)
- [ ] Dark/Light mode toggle
- [ ] Accessibility (WCAG 2.1 AA)

## Troubleshooting

### Map not rendering

```bash
# Check Mapbox token
echo $REACT_APP_MAPBOX_TOKEN

# Should output: pk_live_xxx
```

### Charts not updating

1. Check WebSocket connection:
   ```jsx
   console.log(connected); // Should be true
   ```

2. Verify alert data:
   ```jsx
   console.log(alerts); // Should have items
   ```

3. Check browser console for errors

### Performance slow

- Reduce number of alerts displayed
- Use `React.memo()` to prevent unnecessary re-renders
- Memoize event handlers with `useCallback`

## Support

Email: dashboard@sentiqs.com
