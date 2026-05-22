'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ConnectorCard } from '@/components/connector-card';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Plus, RefreshCw, Wifi, WifiOff, Archive, Activity } from 'lucide-react';

interface Connector {
  id: string;
  name: string;
  description?: string | null;
  status: 'online' | 'offline' | 'error';
  enabled: boolean;
  totalArchived: number;
  successRate: number;
  lastArchivedAt?: string | null;
}

export default function DashboardPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<Connector[]>('/api/connectors');
      setConnectors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        await fetchApi(`/api/connectors/${id}/toggle`, {
          method: 'POST',
          body: JSON.stringify({ enabled }),
        });
        await fetchConnectors();
      } catch {
        setError('Failed to toggle connector');
      }
    },
    [fetchConnectors],
  );

  const activeCount = connectors.filter((c) => c.enabled).length;

  const archivedToday = connectors.filter((c) => {
    if (!c.lastArchivedAt) return false;
    const today = new Date();
    const archived = new Date(c.lastArchivedAt);
    return (
      archived.getFullYear() === today.getFullYear() &&
      archived.getMonth() === today.getMonth() &&
      archived.getDate() === today.getDate()
    );
  }).length;

  const avgSuccessRate =
    connectors.length > 0
      ? connectors.reduce((sum, c) => sum + c.successRate, 0) / connectors.length
      : null;

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-10 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <LayoutDashboard className="h-12 w-12 text-red-500" />
        <p className="text-red-400 text-lg font-medium">Failed to load connectors</p>
        <p className="text-zinc-500 text-sm max-w-md text-center">{error}</p>
        <Button onClick={fetchConnectors}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-zinc-400" />
          <h1 className="text-3xl font-bold text-white">Connectors</h1>
        </div>
        <Button asChild>
          <Link href="/dashboard/connectors/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Connector
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Total Connectors
            </CardTitle>
            <Wifi className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{connectors.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Active Connectors
            </CardTitle>
            <Wifi
              className={cn(
                'h-4 w-4',
                activeCount > 0 ? 'text-green-400' : 'text-zinc-500',
              )}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Total Archived Today
            </CardTitle>
            <Archive className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{archivedToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Overall Success Rate
            </CardTitle>
            <Activity className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {avgSuccessRate !== null
                ? `${avgSuccessRate >= 100 ? '100' : avgSuccessRate.toFixed(1)}%`
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {connectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <WifiOff className="h-12 w-12 text-zinc-600" />
          <p className="text-zinc-300 text-lg font-medium">
            No connectors yet. Create your first one!
          </p>
          <Button asChild>
            <Link href="/dashboard/connectors/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Connector
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connectors.map((connector) => (
            <ConnectorCard
              key={connector.id}
              id={connector.id}
              name={connector.name}
              description={connector.description}
              status={connector.status}
              enabled={connector.enabled}
              totalArchived={connector.totalArchived}
              successRate={connector.successRate}
              lastArchivedAt={connector.lastArchivedAt}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
