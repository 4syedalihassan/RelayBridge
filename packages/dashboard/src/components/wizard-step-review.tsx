'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DiscordServer } from '@/components/wizard-step-server';
import type { DiscordChannel } from '@/components/wizard-step-channels';

export interface WizardData {
  name: string;
  description: string;
  hasAuthed: boolean;
  connectedGuildName: string | null;
  selectedServerId: string;
  selectedChannelIds: string[];
  grClientId: string;
  grClientSecret: string;
  grOAuthUrl: string;
  grApiBaseUrl: string;
}

export interface WizardStepReviewProps {
  data: WizardData;
  servers: DiscordServer[];
  channels: DiscordChannel[];
  onEdit: (step: number) => void;
}

function SectionRow({
  label,
  value,
  step,
  onEdit,
}: {
  label: string;
  value: string;
  step: number;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-zinc-800 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-zinc-300 mt-0.5 truncate">{value || <span className="text-zinc-600 italic">Not set</span>}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0 ml-4"
      >
        Edit
      </button>
    </div>
  );
}

export function WizardStepReview({ data, servers, channels, onEdit }: WizardStepReviewProps) {
  const selectedServer = servers.find((s) => s.id === data.selectedServerId);
  const selectedChannelNames = channels
    .filter((c) => data.selectedChannelIds.includes(c.id))
    .map((c) => c.name);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Review your connector configuration before creating it. Click <span className="text-indigo-400">Edit</span> to change any section.
      </p>

      <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
        <SectionRow label="Name" value={data.name} step={0} onEdit={() => onEdit(0)} />
        <SectionRow label="Description" value={data.description || '(none)'} step={0} onEdit={() => onEdit(0)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-300">Discord Connection</h4>
          <button
            type="button"
            onClick={() => onEdit(1)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Edit
          </button>
        </div>
        <div className={cn(
          'rounded-lg border p-4',
          data.hasAuthed ? 'border-green-800 bg-green-950/20' : 'border-zinc-800 bg-zinc-900/50',
        )}>
          {data.hasAuthed ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-green-300">Authorized</span>
              {data.connectedGuildName && (
                <span className="text-sm text-zinc-500">— {data.connectedGuildName}</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic">Not connected</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-300">Server</h4>
          <button
            type="button"
            onClick={() => onEdit(2)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Edit
          </button>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          {selectedServer ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {selectedServer.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm text-zinc-300">{selectedServer.name}</p>
                <p className="text-xs text-zinc-500">{selectedServer.id}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic">Not selected</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-300">Channels</h4>
          <button
            type="button"
            onClick={() => onEdit(3)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Edit
          </button>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          {selectedChannelNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedChannelNames.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  # {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic">None selected</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-300">Global Relay Credentials</h4>
          <button
            type="button"
            onClick={() => onEdit(4)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Edit
          </button>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800">
          <SectionRow label="Client ID" value={data.grClientId} step={4} onEdit={() => onEdit(4)} />
          <SectionRow
            label="Client Secret"
            value={data.grClientSecret ? '••••••••••••••••' : '(not set)'}
            step={4}
            onEdit={() => onEdit(4)}
          />
          <SectionRow label="OAuth URL" value={data.grOAuthUrl} step={4} onEdit={() => onEdit(4)} />
          <SectionRow label="API Base URL" value={data.grApiBaseUrl} step={4} onEdit={() => onEdit(4)} />
        </div>
      </div>
    </div>
  );
}
