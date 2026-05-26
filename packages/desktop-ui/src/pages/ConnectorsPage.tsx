import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ToggleLeft, ToggleRight, Trash2, Eye } from 'lucide-react'
import { bridge, type Connector } from '../lib/bridge'

export function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => bridge.listConnectors()
    .then(setConnectors)
    .catch(console.error)
    .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const handleToggle = async (id: string, enabled: boolean) => {
    await bridge.toggleConnector(id, !enabled)
    load()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete connector "${name}"? This cannot be undone.`)) return
    await bridge.deleteConnector(id)
    load()
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0' }}>Connectors</h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>Manage Discord → Global Relay connections</p>
        </div>
        <Link to="/connectors/new" className="btn btn-primary">
          <Plus size={16} /> New Connector
        </Link>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>Loading…</div>
      ) : connectors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔌</div>
          <div style={{ color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>No connectors yet</div>
          <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 24 }}>
            Create a connector to start bridging Discord messages to Global Relay
          </div>
          <Link to="/connectors/new" className="btn btn-primary">
            <Plus size={16} /> Create connector
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connectors.map(c => (
            <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Status */}
              <span className={`status-dot ${c.health_status}`} style={{ flexShrink: 0 }} />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.name}</div>
                {c.description && (
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{c.total_archived.toLocaleString()}</div>
                <div>archived · {(c.success_rate * 100).toFixed(0)}% success</div>
              </div>

              {/* Status badge */}
              <span className={`badge ${c.enabled ? 'badge-green' : 'badge-gray'}`} style={{ flexShrink: 0 }}>
                {c.enabled ? 'Active' : 'Paused'}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <Link to={`/connectors/${c.id}`} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                  <Eye size={14} />
                </Link>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px' }}
                  onClick={() => handleToggle(c.id, c.enabled)}
                  title={c.enabled ? 'Pause' : 'Start'}
                >
                  {c.enabled ? <ToggleRight size={14} color="#4ade80" /> : <ToggleLeft size={14} />}
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '6px 10px' }}
                  onClick={() => handleDelete(c.id, c.name)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
