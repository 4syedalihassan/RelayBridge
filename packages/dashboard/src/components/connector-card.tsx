'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface ConnectorCardProps {
  id: string;
  name: string;
  description?: string | null;
  status: 'online' | 'offline' | 'error';
  enabled: boolean;
  totalArchived: number;
  successRate: number;
  lastArchivedAt?: string | null;
  onToggle: (id: string, enabled: boolean) => void;
}

const statusConfig: Record<
  'online' | 'offline' | 'error',
  { label: string; variant: 'success' | 'secondary' | 'destructive' }
> = {
  online: { label: 'Online', variant: 'success' },
  offline: { label: 'Offline', variant: 'secondary' },
  error: { label: 'Error', variant: 'destructive' },
};

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
}

function formatPercentage(rate: number): string {
  return `${rate >= 100 ? '100' : rate.toFixed(1)}%`;
}

export function ConnectorCard({
  id,
  name,
  description,
  status,
  enabled,
  totalArchived,
  successRate,
  lastArchivedAt,
  onToggle,
}: ConnectorCardProps) {
  const router = useRouter();
  const config = statusConfig[status];

  return (
    <Card
      className="hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => router.push(`/dashboard/connectors/${id}`)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{name}</span>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
        </div>

        {description && (
          <p className="text-sm text-zinc-400 line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <span>{totalArchived} archived</span>
          <span>{formatPercentage(successRate)} success</span>
          <span>{lastArchivedAt ? formatRelativeTime(lastArchivedAt) : 'Never'}</span>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => onToggle(id, checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
