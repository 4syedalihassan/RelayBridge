import { useEffect, useState } from 'react'
import { bridge, type AppConfig } from '../lib/bridge'
import { Save, Loader2 } from 'lucide-react'

export function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { bridge.getConfig().then(setConfig).catch(console.error) }, [])

  const set = (k: keyof AppConfig) => (v: string | boolean) =>
    setConfig(c => c ? { ...c, [k]: v } : c)

  const handleSave = async () => {
    if (!config) return
    setSaving(true); setSaved(false)
    try { await bridge.updateConfig(config); setSaved(true); setTimeout(() => setSaved(false), 3000) }
    catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  if (!config) return <div style={{ padding: 32, color: '#64748b' }}>Loading settings…</div>

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Settings</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>Application configuration</p>

      <div className="card">
        <h3 style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logging</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Log Level</label>
          <select value={config.log_level} onChange={e => set('log_level')(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#0d1117', border: '1px solid #1e293b', color: '#e2e8f0', fontSize: '0.875rem', outline: 'none' }}>
            {['trace', 'debug', 'info', 'warn', 'error'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <h3 style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 28, paddingTop: 20, borderTop: '1px solid #1e293b' }}>Startup</h3>

        {[
          { key: 'auto_start' as const, label: 'Auto-start bridge on login', desc: 'Automatically start enabled connectors when the app launches' },
          { key: 'auto_update' as const, label: 'Auto-check for updates', desc: 'Check for application updates automatically' },
        ].map(({ key, label, desc }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#e2e8f0', fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{desc}</div>
            </div>
            <button
              onClick={() => set(key)(!config[key])}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: config[key] ? '#4f46e5' : '#334155',
                transition: 'background 0.2s', position: 'relative', flexShrink: 0,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 3, transition: 'left 0.2s',
                left: config[key] ? 23 : 3,
              }} />
            </button>
          </div>
        ))}

        <div style={{ paddingTop: 20, borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span style={{ color: '#4ade80', fontSize: '0.8rem' }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  )
}
