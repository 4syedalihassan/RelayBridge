import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TrendingUp, Users, CheckCircle2, Activity } from 'lucide-react'
import { bridge, type AnalyticsSummary, type Connector } from '../lib/bridge'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: color + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)

  const load = (showLoading = false) => {
    if (showLoading) setLoading(true)
    Promise.all([bridge.getAnalyticsSummary(), bridge.listConnectors()])
      .then(([s, c]) => { setSummary(s); setConnectors(c) })
      .catch(console.error)
      .finally(() => { if (showLoading) setLoading(false) })
  }

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 3000);
    return () => clearInterval(interval);
  }, [])

  const enabledCount = connectors.filter(c => c.enabled).length

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0' }}>Dashboard</h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>Monitor your RelayBridge connectors</p>
        </div>
        <Link to="/connectors/new" className="btn btn-primary">
          <Plus size={16} />
          New Connector
        </Link>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Archived" value={loading ? '…' : (summary?.total_archived ?? 0).toLocaleString()} icon={<TrendingUp size={20} />} color="#818cf8" />
        <StatCard label="Active Connectors" value={loading ? '…' : enabledCount} icon={<Users size={20} />} color="#4ade80" />
        <StatCard label="Success Rate" value={loading ? '…' : `${((summary?.overall_success_rate ?? 0) * 100).toFixed(1)}%`} icon={<CheckCircle2 size={20} />} color="#34d399" />
        <StatCard label="Archived Today" value={loading ? '…' : (summary?.archived_today ?? 0).toLocaleString()} icon={<Activity size={20} />} color="#f59e0b" />
      </div>

      {/* Connectors list */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>Connectors</h2>
        <Link to="/connectors" style={{ fontSize: '0.8rem', color: '#818cf8', textDecoration: 'none' }}>View all →</Link>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>Loading…</div>
      ) : connectors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ color: '#64748b', marginBottom: 12 }}>No connectors yet</div>
          <Link to="/connectors/new" className="btn btn-primary">
            <Plus size={16} /> Create your first connector
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connectors.slice(0, 5).map(c => (
            <Link key={c.id} to={`/connectors/${c.id}`} style={{ textDecoration: 'none' }}>
              <div className="card glass-hover" style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                <span className={`status-dot ${c.health_status}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem' }}>{c.name}</div>
                  {c.description && <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>{c.description}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{c.total_archived.toLocaleString()}</div>
                  <div>archived</div>
                </div>
                <span className={`badge ${c.enabled ? 'badge-green' : 'badge-gray'}`}>
                  {c.enabled ? 'Active' : 'Paused'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
