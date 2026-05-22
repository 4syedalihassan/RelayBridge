'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeEnhancedProps {
  status: 'online' | 'offline' | 'error';
  enabled: boolean;
  lastError?: string | null;
  className?: string;
}

const dotColors: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  error: 'bg-red-500',
};

const badgeStyles: Record<string, string> = {
  online: 'bg-green-100 text-green-800',
  offline: 'bg-gray-100 text-gray-800',
  error: 'bg-red-100 text-red-800',
  disabled: 'bg-gray-100 text-gray-400',
};

export function StatusBadgeEnhanced({ status, enabled, lastError, className }: StatusBadgeEnhancedProps) {
  if (!enabled) {
    return (
      <Badge variant="outline" className={cn(badgeStyles.disabled, className)}>
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-gray-400" />
        Disabled
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(badgeStyles[status], className)}
      title={status === 'error' && lastError ? lastError : undefined}
    >
      <span className={cn('mr-1.5 inline-block h-2 w-2 rounded-full', dotColors[status])} />
      {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Error'}
    </Badge>
  );
}
