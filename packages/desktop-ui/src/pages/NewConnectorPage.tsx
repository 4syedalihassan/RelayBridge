import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { bridge, type CreateConnectorRequest } from '../lib/bridge'

type Step = 1 | 2 | 3 | 4 | 5 | 6

interface WizardData {
  // Step 1: Basic info
  name: string
  description: string
  // Step 2: Discord bot token
  discord_bot_token: string
  discord_client_id: string
  discord_client_secret: string
  // Step 3: Select guild
  discord_guild_id: string
  discord_guild_name: string
  // Step 4: Select channels
  selected_channel_ids: string[]
  // Step 5: GR credentials
  gr_client_id: string
  gr_client_secret: string
  gr_oauth_url: string
  gr_api_base_url: string
  // Step 6: Review (no data)
}

const INITIAL: WizardData = {
  name: '', description: '',
  discord_bot_token: '', discord_client_id: '', discord_client_secret: '',
  discord_guild_id: '', discord_guild_name: '',
  selected_channel_ids: [],
  gr_client_id: '', gr_client_secret: '',
  gr_oauth_url: 'https://auth.globalrelay.com/oauth2/token',
  gr_api_base_url: 'https://api.globalrelay.com/v1',
}

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Basics' },
  { step: 2, label: 'Discord Bot' },
  { step: 3, label: 'Server' },
  { step: 4, label: 'Channels' },
  { step: 5, label: 'Global Relay' },
  { step: 6, label: 'Review' },
]

function ProgressBar({ current }: { current: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
      {STEPS.map(({ step, label }, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: step < current ? '#4f46e5' : step === current ? '#818cf8' : '#1e293b',
              border: `2px solid ${step <= current ? '#4f46e5' : '#1e293b'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: step <= current ? 'white' : '#64748b',
              fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
              transition: 'all 0.2s',
            }}>
              {step < current ? <Check size={14} /> : step}
            </div>
            <span style={{ fontSize: '0.65rem', color: step <= current ? '#818cf8' : '#64748b', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: '0 8px', marginBottom: 16,
              background: step < current ? '#4f46e5' : '#1e293b',
              transition: 'background 0.2s',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; hint?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8,
          background: '#0d1117', border: '1px solid #1e293b', color: '#e2e8f0',
          fontSize: '0.875rem', outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = '#4f46e5' }}
        onBlur={e => { e.target.style.borderColor = '#1e293b' }}
      />
      {hint && <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

export function NewConnectorPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<WizardData>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof WizardData) => (v: string) => setData(d => ({ ...d, [k]: v }))

  const canNext = (): boolean => {
    if (step === 1) return data.name.trim().length > 0
    if (step === 2) return data.discord_bot_token.trim().length > 0 && data.discord_client_id.trim().length > 0
    if (step === 3) return data.discord_guild_id.trim().length > 0
    if (step === 4) return data.selected_channel_ids.length > 0
    if (step === 5) return data.gr_client_id.trim().length > 0 && data.gr_client_secret.trim().length > 0
    return true
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const req: CreateConnectorRequest = {
        name: data.name,
        description: data.description || undefined,
        discord_config: {
          bot_token: data.discord_bot_token,
          client_id: data.discord_client_id,
          client_secret: data.discord_client_secret,
          guild_id: data.discord_guild_id || undefined,
          guild_name: data.discord_guild_name || undefined,
          selected_channel_ids: data.selected_channel_ids,
        },
        gr_config: {
          client_id: data.gr_client_id,
          client_secret: data.gr_client_secret,
          oauth_url: data.gr_oauth_url,
          api_base_url: data.gr_api_base_url,
        },
      }
      await bridge.createConnector(req)
      navigate('/connectors')
    } catch (e) {
      setError(String(e))
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
      <button onClick={() => navigate('/connectors')} className="btn btn-secondary" style={{ marginBottom: 24 }}>
        <ArrowLeft size={14} /> Back
      </button>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>New Connector</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>Bridge Discord messages to Global Relay in 6 steps</p>

      <ProgressBar current={step} />

      <div className="card">
        {/* Step 1: Basics */}
        {step === 1 && (
          <div>
            <h2 style={{ color: '#e2e8f0', marginBottom: 20, fontWeight: 600 }}>Basic Information</h2>
            <Field label="Connector Name *" value={data.name} onChange={set('name')} placeholder="e.g., Legal Team #compliance" />
            <Field label="Description" value={data.description} onChange={set('description')} placeholder="Optional description of this bridge" />
          </div>
        )}

        {/* Step 2: Discord Bot */}
        {step === 2 && (
          <div>
            <h2 style={{ color: '#e2e8f0', marginBottom: 8, fontWeight: 600 }}>Discord Bot Credentials</h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 20 }}>
              Create a bot at discord.com/developers and add it to your server with Message Content Intent enabled.
            </p>
            <Field label="Bot Token *" value={data.discord_bot_token} onChange={set('discord_bot_token')} type="password" placeholder="MTAxNj..." hint="Found in Discord Developer Portal → Bot → Token" />
            <Field label="Client ID *" value={data.discord_client_id} onChange={set('discord_client_id')} placeholder="012345678901234567" hint="Found in Discord Developer Portal → General Information → Application ID" />
            <Field label="Client Secret" value={data.discord_client_secret} onChange={set('discord_client_secret')} type="password" placeholder="optional" />
          </div>
        )}

        {/* Step 3: Select Guild */}
        {step === 3 && (
          <div>
            <h2 style={{ color: '#e2e8f0', marginBottom: 8, fontWeight: 600 }}>Select Server</h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 20 }}>Enter the Discord server (guild) ID to monitor.</p>
            <Field label="Guild ID *" value={data.discord_guild_id} onChange={set('discord_guild_id')} placeholder="012345678901234567" hint="Right-click your server → Copy Server ID (enable Developer Mode first)" />
            <Field label="Guild Name" value={data.discord_guild_name} onChange={set('discord_guild_name')} placeholder="My Company Server" hint="Optional — used for labelling in archive" />
          </div>
        )}

        {/* Step 4: Select Channels */}
        {step === 4 && (
          <div>
            <h2 style={{ color: '#e2e8f0', marginBottom: 8, fontWeight: 600 }}>Select Channels</h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 20 }}>
              Enter comma-separated Discord channel IDs to archive. Leave empty to archive all channels.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Channel IDs *</label>
              <textarea
                value={data.selected_channel_ids.join(', ')}
                onChange={e => setData(d => ({ ...d, selected_channel_ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                placeholder="012345678, 098765432"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#0d1117', border: '1px solid #1e293b', color: '#e2e8f0', fontSize: '0.875rem', outline: 'none', resize: 'vertical' }}
              />
              <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>Right-click a channel → Copy Channel ID</p>
            </div>
          </div>
        )}

        {/* Step 5: GR Credentials */}
        {step === 5 && (
          <div>
            <h2 style={{ color: '#e2e8f0', marginBottom: 8, fontWeight: 600 }}>Global Relay Credentials</h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 20 }}>OAuth2 client credentials for the Global Relay archival API.</p>
            <Field label="Client ID *" value={data.gr_client_id} onChange={set('gr_client_id')} placeholder="your-gr-client-id" />
            <Field label="Client Secret *" value={data.gr_client_secret} onChange={set('gr_client_secret')} type="password" placeholder="your-gr-client-secret" />
            <Field label="OAuth2 Token URL" value={data.gr_oauth_url} onChange={set('gr_oauth_url')} />
            <Field label="API Base URL" value={data.gr_api_base_url} onChange={set('gr_api_base_url')} />
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div>
            <h2 style={{ color: '#e2e8f0', marginBottom: 20, fontWeight: 600 }}>Review & Create</h2>
            {[
              { label: 'Name', value: data.name },
              { label: 'Server ID', value: data.discord_guild_id || '—' },
              { label: 'Channels', value: data.selected_channel_ids.length ? data.selected_channel_ids.join(', ') : 'All channels' },
              { label: 'GR API URL', value: data.gr_api_base_url },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b', fontSize: '0.875rem' }}>
                <span style={{ color: '#64748b' }}>{label}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            {error && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8, marginTop: 16, fontSize: '0.8rem' }}>{error}</div>}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setStep(s => Math.max(1, s - 1) as Step)}
            disabled={step === 1}
          >
            <ArrowLeft size={14} /> Previous
          </button>

          {step < 6 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => (s + 1) as Step)} disabled={!canNext()}>
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Check size={14} /> Create Connector</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
