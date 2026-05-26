import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import './index.css'

// Pages
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { ConnectorsPage } from './pages/ConnectorsPage'
import { ConnectorDetailPage } from './pages/ConnectorDetailPage'
import { NewConnectorPage } from './pages/NewConnectorPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
