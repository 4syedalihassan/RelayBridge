'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConnectorWizard } from '@/components/connector-wizard';

export default function NewConnectorPage() {
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
        <h1 className="text-2xl font-semibold text-zinc-100">Create New Connector</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configure a new bridge between a Discord server and Global Relay.
        </p>
      </div>

      <ConnectorWizard />
    </div>
  );
}
