import { useEffect, useState } from 'react'
import { bridge, type Connector, type ConnectorAnalytics } from '../lib/bridge'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function ConnectorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [connector, setConnector] = useState<Connector | null>(null)
  const [analytics, setAnalytics] = useState<ConnectorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (showLoading = false) => {
    if (!id) return
    if (showLoading) setLoading(true)
    try {
      const [c, a] = await Promise.all([bridge.getConnector(id), bridge.getConnectorAnalytics(id)])
      setConnector(c); setAnalytics(a)
    } catch (e) { console.error(e) }
    finally { if (showLoading) setLoading(false) }
  }

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 3000);
    return () => clearInterval(interval);
  }, [id])

  const handleToggle = async () => {
    if (!connector) return
    await bridge.toggleConnector(connector.id, !connector.enabled)
    load(false)
  }

  const handleDelete = async () => {
    if (!connector) return
    if (!confirm(`Delete "${connector.name}"?`)) return
    await bridge.deleteConnector(connector.id)
    navigate('/connectors')
  }

  if (loading) return <div style={{ padding: 32, color: '#64748b' }}>Loading…</div>
  if (!connector) return <div style={{ padding: 32, color: '#f87171' }}>Connector not found</div>

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => navigate('/connectors')} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
          <ArrowLeft size={14} />
        </button>
        <span className={`status-dot ${connector.health_status}`} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e2e8f0' }}>{connector.name}</h1>
          {connector.description && <p style={{ color: '#64748b', fontSize: '0.8rem' }}>{connector.description}</p>}
        </div>
        <button className="btn btn-secondary" onClick={handleToggle} style={{ gap: 8 }}>
          {connector.enabled ? <ToggleRight size={16} color="#4ade80" /> : <ToggleLeft size={16} />}
          {connector.enabled ? 'Pause' : 'Start'}
        </button>
        <button className="btn btn-danger" onClick={handleDelete}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Archived', value: connector.total_archived.toLocaleString() },
          { label: 'Success Rate', value: `${(connector.success_rate * 100).toFixed(1)}%` },
          { label: 'Failed', value: connector.failed_count.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {analytics && analytics.daily_volume.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>DAILY VOLUME</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.daily_volume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Last error */}
      {connector.last_error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 16 }}>
          <div style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Last Error</div>
          <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontFamily: 'monospace' }}>{connector.last_error}</div>
        </div>
      )}
    </div>
  )
}
