'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { ConnectorWizard } from '@/components/connector-wizard';
import { fetchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { WizardData } from '@/components/wizard-step-review';

interface ConnectorResponse extends Partial<WizardData> {
  id: string;
  status: string;
  enabled: boolean;
  totalArchived: number;
  successRate: number;
  lastArchivedAt: string | null;
}

export default function EditConnectorPage() {
  const params = useParams<{ id: string }>();
  const [connector, setConnector] = useState<ConnectorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchConnector = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const data = await fetchApi<ConnectorResponse>(`/api/connectors/${params.id}`);
      setConnector(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load connector.');
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchConnector();
  }, [fetchConnector]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500" />
            <p className="text-sm text-zinc-400">Loading connector...</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-xl font-semibold text-zinc-300">Connector not found</h2>
          <p className="mt-2 text-sm text-zinc-500">
            The connector you are looking for does not exist or has been removed.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-xl font-semibold text-red-400">Failed to load connector</h2>
          <p className="mt-2 text-sm text-zinc-500">{error}</p>
          <Button
            variant="outline"
            className="mt-6 gap-2"
            onClick={fetchConnector}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Edit Connector</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Update the configuration for <span className="text-zinc-300 font-medium">{connector?.name}</span>.
        </p>
      </div>

      {connector && (
        <ConnectorWizard initialData={connector} />
      )}
    </div>
  );
}
