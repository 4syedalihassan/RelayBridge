'use client';

import { cn } from '@/lib/utils';

interface HealthIndicatorProps {
  status: 'online' | 'offline' | 'error';
  lastError?: string | null;
  lastHealthCheckAt?: string | null;
  className?: string;
}

function relativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HealthIndicator({ status, lastError, lastHealthCheckAt, className }: HealthIndicatorProps) {
  if (status === 'online') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
        </span>
        <span className="text-sm text-green-700">All systems operational</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        <span className="text-sm text-red-700">
          Error: {lastError ?? 'Error state'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="inline-block h-3 w-3 rounded-full bg-gray-400" />
      <span className="text-sm text-gray-500">
        Last seen: {lastHealthCheckAt ? relativeTime(lastHealthCheckAt) : 'Never checked'}
      </span>
    </div>
  );
}
