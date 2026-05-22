'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchApi } from '@/lib/api';

interface ArchiveLogEntry {
  id: string;
  eventType: string;
  status: string;
  errorMessage?: string;
  grReconciliationId?: string;
  archivedAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ArchiveLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<ArchiveLogEntry[]>('/api/logs')
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'success': return 'success' as const;
      case 'failed': return 'destructive' as const;
      case 'pending': return 'warning' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Archive Logs</h1>
        <p className="text-zinc-400 mt-1">History of archived events</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-zinc-400">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="p-6 text-zinc-500">No archive logs yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 text-zinc-400 font-medium">Event Type</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Status</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Reconciliation ID</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Archived At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-800/50">
                    <td className="p-4 text-white">{log.eventType}</td>
                    <td className="p-4">
                      <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                    </td>
                    <td className="p-4 text-zinc-400 font-mono text-xs">
                      {log.grReconciliationId ?? '-'}
                    </td>
                    <td className="p-4 text-zinc-400">
                      {new Date(log.archivedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
