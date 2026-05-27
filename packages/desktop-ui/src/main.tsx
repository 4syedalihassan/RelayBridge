import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './index.css'

// Pages
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { ConnectorsPage } from './pages/ConnectorsPage'
import { ConnectorDetailPage } from './pages/ConnectorDetailPage'
import { NewConnectorPage } from './pages/NewConnectorPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SplashCard } from './components/SplashCard'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'connectors', element: <ConnectorsPage /> },
      { path: 'connectors/new', element: <NewConnectorPage /> },
      { path: 'connectors/:id', element: <ConnectorDetailPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

let isSplashscreen = false
try {
  isSplashscreen = getCurrentWindow().label === 'splashscreen'
} catch (e) {
  // Safe fallback if running in dev server outside tauri
  isSplashscreen = window.location.search.includes('splash')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSplashscreen ? <SplashCard /> : <RouterProvider router={router} />}
  </React.StrictMode>
)
