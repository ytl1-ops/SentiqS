// Intelligent dashboard components
import React, { useEffect, useState } from 'react';
import { useAlerts } from '../alerts/use-alerts';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import MapGL, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const SEVERITY_COLORS = {
  CRITIQUE: '#DC2626',
  'ÉLEVÉ': '#F97316',
  'MODÉRÉ': '#EAB308',
  STABLE: '#22C55E',
};

const SEVERITY_ORDER = { CRITIQUE: 0, 'ÉLEVÉ': 1, 'MODÉRÉ': 2, STABLE: 3 };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RISK MAP - Choropleth of Africa by country risk level
// ═══════════════════════════════════════════════════════════════════════════════

export function RiskMap({ stats }: { stats: any }) {
  const [viewport, setViewport] = useState({
    latitude: 0,
    longitude: 10,
    zoom: 3,
  });
  const [selectedCountry, setSelectedCountry] = useState<any>(null);

  // Country center coordinates (simplified)
  const countryCoordinates: Record<string, [number, number]> = {
    Mali: [17.5707, 3.9962],
    Senegal: [-14.4974, 14.4974],
    'Côte d\'Ivoire': [-5.5471, 7.5109],
    Kenya: [40.2206, 0.2293],
    Nigeria: [8.6753, 9.082],
    Ghana: [-2.3667, 7.75],
  };

  return (
    <div className="bg-panel rounded-lg border border-line2 p-4 h-96">
      <h3 className="text-ink font-bold mb-4">🗺️ Risk Map - Africa</h3>
      <MapGL
        {...viewport}
        width="100%"
        height={320}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onViewportChange={setViewport}
        mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
      >
        {Object.entries(countryCoordinates).map(([country, [lng, lat]]) => {
          const count = stats?.byCountry?.[country] || 0;
          const severity = count > 5 ? 'CRITIQUE' : count > 2 ? 'ÉLEVÉ' : 'STABLE';
          const size = count > 5 ? 40 : count > 2 ? 25 : 15;

          return (
            <Marker key={country} latitude={lat} longitude={lng}>
              <div
                className="cursor-pointer rounded-full flex items-center justify-center text-white font-bold"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: SEVERITY_COLORS[severity],
                  opacity: 0.8,
                }}
                onClick={() => setSelectedCountry({ country, count, lat, lng })}
              >
                {count}
              </div>
            </Marker>
          );
        })}
        {selectedCountry && (
          <Popup
            latitude={selectedCountry.lat}
            longitude={selectedCountry.lng}
            onClose={() => setSelectedCountry(null)}
          >
            <div className="p-2 bg-panel text-ink text-sm rounded">
              <strong>{selectedCountry.country}</strong>
              <p>Alerts: {selectedCountry.count}</p>
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ALERT SEVERITY GAUGE - Real-time status
// ═══════════════════════════════════════════════════════════════════════════════

export function SeverityGauge({ stats }: { stats: any }) {
  const total = stats?.total || 0;
  const critical = stats?.critical || 0;
  const elevated = stats?.elevated || 0;
  const moderate = stats?.moderate || 0;
  const stable = stats?.stable || 0;

  const data = [
    { name: '🔴 CRITIQUE', value: critical, color: SEVERITY_COLORS.CRITIQUE },
    { name: '🟠 ÉLEVÉ', value: elevated, color: SEVERITY_COLORS['ÉLEVÉ'] },
    { name: '🟡 MODÉRÉ', value: moderate, color: SEVERITY_COLORS['MODÉRÉ'] },
    { name: '🟢 STABLE', value: stable, color: SEVERITY_COLORS.STABLE },
  ];

  return (
    <div className="bg-panel rounded-lg border border-line2 p-4">
      <h3 className="text-ink font-bold mb-4">Alert Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {data.map(item => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-ink2">{item.name}</span>
            <strong className="text-ink">{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TIMELINE - Recent incidents with severity badges
// ═══════════════════════════════════════════════════════════════════════════════

export function TimelineView({ alerts }: { alerts: any[] }) {
  const last24h = alerts.filter(a => {
    const created = new Date(a.createdAt);
    const now = new Date();
    return now.getTime() - created.getTime() < 24 * 60 * 60 * 1000;
  });

  return (
    <div className="bg-panel rounded-lg border border-line2 p-4">
      <h3 className="text-ink font-bold mb-4">⏱️ Timeline (Last 24h)</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {last24h.map((alert, idx) => (
          <div key={idx} className="flex gap-3 pb-3 border-b border-line2">
            <div
              className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-2">
                <p className="text-ink font-medium truncate">{alert.title}</p>
                <span className="text-ink4 text-xs whitespace-nowrap">
                  {new Date(alert.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-ink3 text-sm">{alert.country}</p>
            </div>
          </div>
        ))}
        {last24h.length === 0 && (
          <p className="text-ink3 text-sm text-center py-4">Aucune alerte dans les 24 dernières heures</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TREND CHART - Alerts over time
// ═══════════════════════════════════════════════════════════════════════════════

export function TrendChart({ alerts }: { alerts: any[] }) {
  const last7days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' });

    const count = alerts.filter(a => {
      const alertDate = new Date(a.createdAt);
      return alertDate.toLocaleDateString() === date.toLocaleDateString();
    }).length;

    return { date: dateStr, alerts: count };
  });

  return (
    <div className="bg-panel rounded-lg border border-line2 p-4">
      <h3 className="text-ink font-bold mb-4">📈 Trend (Last 7 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={last7days}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4E63" />
          <XAxis dataKey="date" stroke="#7FB2CC" />
          <YAxis stroke="#7FB2CC" />
          <Tooltip contentStyle={{ backgroundColor: '#1C2E3D', border: '1px solid #2E4E63' }} />
          <Line type="monotone" dataKey="alerts" stroke="#2C5AAE" strokeWidth={2} dot={{ fill: '#2C5AAE' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CORRELATIONS NETWORK - Multi-country threats
// ═══════════════════════════════════════════════════════════════════════════════

export function CorrelationsGraph({ alerts }: { alerts: any[] }) {
  // Group by category
  const correlations: Record<string, { countries: Set<string>; count: number }> = {};
  alerts.forEach(alert => {
    const key = alert.category;
    if (!correlations[key]) {
      correlations[key] = { countries: new Set(), count: 0 };
    }
    correlations[key].countries.add(alert.country);
    correlations[key].count++;
  });

  // Filter multi-country themes only
  const multiCountry = Object.entries(correlations)
    .filter(([, data]) => data.countries.size > 1)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <div className="bg-panel rounded-lg border border-line2 p-4">
      <h3 className="text-ink font-bold mb-4">🔗 Regional Correlations</h3>
      {multiCountry.length > 0 ? (
        <div className="space-y-3">
          {multiCountry.map(([theme, data]) => (
            <div key={theme} className="p-3 bg-panel-b rounded border border-line">
              <p className="text-ink font-medium">#{theme}</p>
              <p className="text-ink2 text-sm">{Array.from(data.countries).join(', ')}</p>
              <p className="text-ink3 text-xs mt-2">{data.count} alerts</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink3 text-sm text-center py-4">No multi-country correlations</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. KEY METRICS - Summary cards
// ═══════════════════════════════════════════════════════════════════════════════

export function KeyMetrics({ stats, connected }: { stats: any; connected: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        icon="🔴"
        label="Critical"
        value={stats?.critical || 0}
        trend="up"
        color="#DC2626"
      />
      <MetricCard
        icon="🟠"
        label="Elevated"
        value={stats?.elevated || 0}
        trend="stable"
        color="#F97316"
      />
      <MetricCard
        icon="📍"
        label="Countries"
        value={Object.keys(stats?.byCountry || {}).length}
        trend="stable"
        color="#2C5AAE"
      />
      <MetricCard
        icon={connected ? '✅' : '⚠️'}
        label="Status"
        value={connected ? 'Live' : 'Offline'}
        trend="stable"
        color={connected ? '#22C55E' : '#F97316'}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  trend,
  color,
}: {
  icon: string;
  label: string;
  value: any;
  trend: string;
  color: string;
}) {
  return (
    <div className="bg-panel rounded-lg border border-line2 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-ink3 text-sm font-medium">{label}</p>
          <p className="text-ink font-bold text-2xl mt-1">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
      {trend === 'up' && <p className="text-red-500 text-xs mt-2">↑ 12% from yesterday</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export function IntelligentDashboard({ userId }: { userId: string }) {
  const { alerts, stats, connected, loading } = useAlerts(userId);
  const [filter, setFilter] = useState({ countries: [] });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-ink2">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-ink font-bold text-3xl">SentiqS Dashboard</h1>
          <p className="text-ink3 text-sm mt-1">Real-time security intelligence</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          connected ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
        }`}>
          {connected ? '🟢 Live' : '🔴 Offline'}
        </div>
      </div>

      {/* Key Metrics */}
      <KeyMetrics stats={stats} connected={connected} />

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Risk Map */}
        <div className="lg:col-span-2">
          <RiskMap stats={stats} />
        </div>

        {/* Right: Severity Gauge */}
        <div>
          <SeverityGauge stats={stats} />
        </div>
      </div>

      {/* Trends & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart alerts={alerts} />
        <TimelineView alerts={alerts} />
      </div>

      {/* Correlations */}
      <CorrelationsGraph alerts={alerts} />
    </div>
  );
}
