'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface DailyDataPoint {
  date: string;
  count: number;
}

interface AnalyticsData {
  connectorId: string;
  totalArchived: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  dailyVolume: DailyDataPoint[];
  dailyErrors: DailyDataPoint[];
}

interface AnalyticsChartsProps {
  connectorId: string;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' });
}

function getLastArchived(data: AnalyticsData): string {
  if (data.dailyVolume.length === 0) return 'Never';
  const lastEntry = data.dailyVolume[data.dailyVolume.length - 1];
  const date = new Date(lastEntry.date + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 1) return 'Less than an hour ago';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSuccessRateColor(rate: number): string {
  if (rate > 95) return 'text-green-600';
  if (rate > 80) return 'text-yellow-600';
  return 'text-red-600';
}

function toSuccessRateData(
  dailyVolume: DailyDataPoint[],
  dailyErrors: DailyDataPoint[],
): (DailyDataPoint & { successRate: number })[] {
  return dailyVolume.map((d) => {
    const errors = dailyErrors.find((e) => e.date === d.date);
    const total = d.count;
    const errCount = errors?.count ?? 0;
    const rate = total > 0 ? ((total - errCount) / total) * 100 : 100;
    return { ...d, successRate: Math.round(rate * 100) / 100 };
  });
}

export function AnalyticsCharts({ connectorId }: AnalyticsChartsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/connectors/${connectorId}/analytics`, {
          signal: abortController.signal,
        });
        if (!res.ok) throw new Error('Failed to load analytics');
        const json = (await res.json()) as AnalyticsData;
        if (!abortController.signal.aborted) {
          setData(json);
        }
      } catch (err) {
        if (abortController.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => abortController.abort();
  }, [connectorId, retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12">
          <p className="text-destructive text-lg font-medium">{error}</p>
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalArchived === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <svg
              className="h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
              />
            </svg>
          </div>
          <p className="text-lg text-muted-foreground">No data yet — start archiving!</p>
        </CardContent>
      </Card>
    );
  }

  const successRateColor = getSuccessRateColor(data.successRate);
  const trendData = toSuccessRateData(data.dailyVolume, data.dailyErrors);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Archived</p>
            <p className="text-3xl font-bold">{data.totalArchived.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className={`text-3xl font-bold ${successRateColor}`}>
              {data.successRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Failed Count</p>
            <p className="text-3xl font-bold text-red-600">
              {data.errorCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Last Archived</p>
            <p className="text-3xl font-bold">{getLastArchived(data)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Archive Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                className="text-xs text-muted-foreground"
              />
              <YAxis className="text-xs text-muted-foreground" />
              <Tooltip
                labelFormatter={(label) => formatDateLabel(label as string)}
                formatter={(value) => [Number(value), 'Archived']}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {data.dailyVolume.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Success Rate Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  className="text-xs text-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  className="text-xs text-muted-foreground"
                />
                <Tooltip
                  labelFormatter={(label) => formatDateLabel(label as string)}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Success Rate']}
                />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
