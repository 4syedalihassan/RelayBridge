'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { Server, MessageSquare, Activity, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStatus {
  servers: number;
  activeChannels: number;
  uptime: number;
  recentLogs: Array<{ id: string; eventType: string; status: string; archivedAt: string }>;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-zinc-400">Loading...</p>;
  if (!status) return <p className="text-red-400">Failed to load status</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Overview of your archive bridge</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard title="Servers" value={status.servers} icon={Server} />
        <StatsCard title="Active Channels" value={status.activeChannels} icon={MessageSquare} />
        <StatsCard title="Bridge Uptime" value={status.uptime != null ? `${Math.floor(status.uptime)}s` : 'N/A'} icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Recent Archive Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {status.recentLogs.length === 0 ? (
            <p className="text-zinc-500 text-sm">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {status.recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-zinc-300">{log.eventType}</span>
                  </div>
                  <StatusBadge status={log.status as any} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
