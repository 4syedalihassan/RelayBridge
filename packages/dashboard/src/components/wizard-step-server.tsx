'use client';

import { cn } from '@/lib/utils';

export interface DiscordServer {
  id: string;
  name: string;
  memberCount: number;
}

export interface WizardStepServerProps {
  servers: DiscordServer[];
  selectedServerId: string | null;
  onSelect: (serverId: string) => void;
}

export function WizardStepServer({ servers, selectedServerId, onSelect }: WizardStepServerProps) {
  if (servers.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
        <p className="text-sm text-zinc-400">No Discord servers found.</p>
        <p className="text-xs text-zinc-500 mt-1">
          Make sure the Discord bot is added to at least one server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 mb-4">
        Select the Discord server you want to archive messages from.
      </p>
      {servers.map((server) => (
        <button
          key={server.id}
          type="button"
          onClick={() => onSelect(server.id)}
          className={cn(
            'w-full text-left p-4 rounded-lg border transition-colors',
            selectedServerId === server.id
              ? 'border-indigo-500 bg-indigo-950/30'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold shrink-0">
              {server.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{server.name}</p>
              <p className="text-xs text-zinc-500">{server.memberCount.toLocaleString()} members</p>
            </div>
            {selectedServerId === server.id && (
              <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
