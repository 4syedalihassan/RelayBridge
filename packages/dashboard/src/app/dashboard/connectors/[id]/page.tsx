'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadgeEnhanced } from '@/components/status-badge-enhanced';
import { HealthIndicator } from '@/components/health-indicator';
import { AnalyticsCharts } from '@/components/analytics-charts';
import { ConnectorForm } from '@/components/connector-form';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ArrowLeft, Edit2, Trash2, Play, Square, RefreshCw } from 'lucide-react';

interface ConnectorResponse {
  id: string;
  name: string;
  description: string | null;
  discordServerId: string;
  discordChannelIds: string;
  grClientId: string;
  grClientSecret: string;
  grOAuthUrl: string;
  grApiBaseUrl: string;
  enabled: boolean;
  status: string;
  lastHealthCheckAt: string | null;
  totalArchived?: number;
  successRate?: number;
  failedCount?: number;
  lastArchivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Connector {
  id: string;
  name: string;
  description?: string | null;
  discordServerId: string;
  discordChannelIds: string;
  grClientId: string;
  grClientSecret: string;
  grOAuthUrl: string;
  grApiBaseUrl: string;
  enabled: boolean;
  status: 'online' | 'offline' | 'error';
  lastHealthCheckAt?: string | null;
  totalArchived?: number;
  successRate?: number;
  failedCount?: number;
  lastArchivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

type Tab = 'overview' | 'configuration' | 'analytics' | 'actions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'actions', label: 'Actions' },
];

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConnectorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectorId = params.id as string;

  const [connector, setConnector] = useState<Connector | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchConnector = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await fetchApi<Connector>(`/api/connectors/${connectorId}`);
      setConnector(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load connector';
      if (message.includes('404')) {
        setNotFound(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [connectorId]);

  useEffect(() => {
    fetchConnector();
  }, [fetchConnector]);

  const handleToggle = useCallback(async () => {
    if (!connector) return;
    setToggling(true);
    setError(null);
    try {
      const updated = await fetchApi<Connector>(`/api/connectors/${connector.id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !connector.enabled }),
      });
      setConnector(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle connector');
    } finally {
      setToggling(false);
    }
  }, [connector]);

  const handleDelete = useCallback(async () => {
    if (!connector) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${connector.name}"?\n\nThis action cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await fetchApi(`/api/connectors/${connector.id}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connector');
      setDeleting(false);
    }
  }, [connector, router]);

  const handleSave = useCallback((updated: ConnectorResponse) => {
    setConnector(updated as Connector);
    setIsEditing(false);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <h2 className="text-2xl font-bold text-white">Connector not found</h2>
        <p className="text-zinc-500 text-sm max-w-md text-center">
          The connector you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  if (error && !connector) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-400 text-lg font-medium">Failed to load connector</p>
        <p className="text-zinc-500 text-sm max-w-md text-center">{error}</p>
        <div className="flex gap-3">
          <Button onClick={fetchConnector}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!connector) return null;

  const successRate = connector.successRate ?? 0;
  const failedCount = connector.failedCount ?? 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-white">{connector.name}</h1>
          </div>
          <div className="flex items-center gap-3 ml-12">
            <StatusBadgeEnhanced status={connector.status} enabled={connector.enabled} />
            <HealthIndicator
              status={connector.status}
              lastHealthCheckAt={connector.lastHealthCheckAt}
            />
          </div>
          <p className="text-sm text-zinc-500 ml-12">
            Updated {relativeTime(connector.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            {connector.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            id="connector-toggle"
            checked={connector.enabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </div>
      </div>

      <div className="flex border-b border-zinc-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-white text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Health Status</CardTitle>
            </CardHeader>
            <CardContent>
              <HealthIndicator
                status={connector.status}
                lastHealthCheckAt={connector.lastHealthCheckAt}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400">Total Archived</p>
                <p className="text-2xl font-bold text-white">
                  {connector.totalArchived?.toLocaleString() ?? 'N/A'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400">Success Rate</p>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    successRate > 95
                      ? 'text-green-500'
                      : successRate > 80
                        ? 'text-yellow-500'
                        : 'text-red-500',
                  )}
                >
                  {successRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400">Failed Count</p>
                <p className="text-2xl font-bold text-red-500">
                  {failedCount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400">Last Archived</p>
                <p className="text-2xl font-bold text-white">
                  {connector.lastArchivedAt ? relativeTime(connector.lastArchivedAt) : 'Never'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Created</span>
                <span className="text-white">{formatDate(connector.createdAt)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Updated</span>
                <span className="text-white">{formatDate(connector.updatedAt)}</span>
              </div>
              {connector.description && (
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Description</span>
                  <span className="text-white text-right max-w-md">{connector.description}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'configuration' && (
        <div className="space-y-6">
          {isEditing ? (
            <ConnectorForm
              connector={connector}
              onSave={handleSave}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Configuration</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-400">Name</p>
                    <p className="text-white">{connector.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Description</p>
                    <p className="text-white">{connector.description || 'No description'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Discord Server ID</p>
                    <p className="text-white font-mono text-sm">{connector.discordServerId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Discord Channel IDs</p>
                    <p className="text-white font-mono text-sm">{connector.discordChannelIds}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Client ID</p>
                    <p className="text-white font-mono text-sm">{connector.grClientId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">OAuth URL</p>
                    <p className="text-white font-mono text-sm break-all">{connector.grOAuthUrl}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-zinc-400">API Base URL</p>
                    <p className="text-white font-mono text-sm break-all">
                      {connector.grApiBaseUrl}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'analytics' && <AnalyticsCharts connectorId={connector.id} />}

      {activeTab === 'actions' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                {connector.enabled
                  ? 'This connector is currently running and archiving messages.'
                  : 'This connector is currently stopped.'}
              </p>
              <Button
                variant={connector.enabled ? 'destructive' : 'default'}
                onClick={handleToggle}
                disabled={toggling}
              >
                {connector.enabled ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    {toggling ? 'Stopping...' : 'Stop'}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {toggling ? 'Starting...' : 'Start'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-800">
            <CardHeader>
              <CardTitle className="text-red-500">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                Once you delete a connector, there is no going back. Please be certain.
              </p>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete Connector'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
