import { useEffect, useState } from 'react'
import { bridge, type AnalyticsSummary, type Connector, type ConnectorAnalytics } from '../lib/bridge'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

const COLORS = ['#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185']

export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [analytics, setAnalytics] = useState<ConnectorAnalytics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([bridge.getAnalyticsSummary(), bridge.listConnectors()])
      .then(async ([s, cs]) => {
        setSummary(s); setConnectors(cs)
        const a = await Promise.all(cs.map(c => bridge.getConnectorAnalytics(c.id)))
        setAnalytics(a)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Merge daily volumes across all connectors for the global area chart
  const globalVolume = analytics.reduce<Record<string, number>>((acc, ca) => {
    ca.daily_volume.forEach(dv => { acc[dv.date] = (acc[dv.date] || 0) + dv.count })
    return acc
  }, {})
  const globalSeries = Object.entries(globalVolume).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading analytics…</div>

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Analytics</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>Archive volume and performance across all connectors</p>

      {/* Global chart */}
      {globalSeries.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>TOTAL ARCHIVED — 30 DAYS</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={globalSeries}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Area type="monotone" dataKey="count" stroke="#818cf8" fill="url(#areaGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-connector bar chart */}
      {connectors.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>ARCHIVED BY CONNECTOR (TOTAL)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={connectors.map((c, i) => ({ name: c.name, count: c.total_archived, color: COLORS[i % COLORS.length] }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {connectors.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary table */}
      <div className="card">
        <h3 style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>CONNECTOR PERFORMANCE</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ color: '#64748b', textAlign: 'left' }}>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>Connector</th>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>Archived</th>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>Failed</th>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {connectors.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #1e293b' }}>
                <td style={{ padding: '10px 0', color: '#e2e8f0' }}>{c.name}</td>
                <td style={{ padding: '10px 0', color: '#e2e8f0' }}>{c.total_archived.toLocaleString()}</td>
                <td style={{ padding: '10px 0', color: '#f87171' }}>{c.failed_count.toLocaleString()}</td>
                <td style={{ padding: '10px 0' }}>
                  <span className={`badge ${c.success_rate >= 0.95 ? 'badge-green' : c.success_rate >= 0.8 ? 'badge-purple' : 'badge-red'}`}>
                    {(c.success_rate * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
