import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, PlugZap, BarChart3, Settings } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/connectors', label: 'Connectors', icon: PlugZap },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)',
        flexShrink: 0,
        background: '#0d1117',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', marginBottom: 32 }}>
          {/* RelayBridge shield logo — identical to splash screen */}
          <svg width="32" height="32" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 22 L168 52 V112 C168 156 100 180 100 180 C100 180 32 156 32 112 V52 Z" fill="#1e3a8a" />
            <path d="M 54,83 C 70,74 132,74 148,83 C 132,92 70,92 54,83 Z" fill="#e6a817" />
            <path d="M 52,103 C 68,94 134,94 150,103 C 134,112 68,112 52,103 Z" fill="#e6a817" />
            <path d="M 58,123 C 72,114 130,114 144,123 C 130,132 72,132 58,123 Z" fill="#e6a817" />
          </svg>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>RelayBridge</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>v0.1.0</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: status indicator */}
        <div style={{ marginTop: 'auto', padding: '12px 4px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#64748b' }}>
            <span className="status-dot online" />
            Bridge running
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#0a0a0f' }}>
        <Outlet />
      </main>
    </div>
  )
}
