import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: 'connected' | 'disconnected' | 'error' | 'archiving';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'default' }> = {
    connected: { label: 'Connected', variant: 'success' },
    disconnected: { label: 'Disconnected', variant: 'destructive' },
    error: { label: 'Error', variant: 'warning' },
    archiving: { label: 'Archiving', variant: 'default' },
  };

  const s = map[status] ?? { label: status, variant: 'default' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
