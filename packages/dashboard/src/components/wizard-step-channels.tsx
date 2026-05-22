'use client';

import { Switch } from '@/components/ui/switch';
import { Hash } from 'lucide-react';

export interface DiscordChannel {
  id: string;
  name: string;
}

export interface WizardStepChannelsProps {
  channels: DiscordChannel[];
  selectedChannelIds: string[];
  onToggle: (channelId: string, enabled: boolean) => void;
}

export function WizardStepChannels({ channels, selectedChannelIds, onToggle }: WizardStepChannelsProps) {
  if (channels.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
        <p className="text-sm text-zinc-400">No text channels available.</p>
        <p className="text-xs text-zinc-500 mt-1">
          The selected server does not have any accessible text channels.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 mb-4">
        Select which text channels to archive. Toggle channels on or off.
      </p>

      <div className="space-y-1">
        {channels.map((channel) => {
          const isSelected = selectedChannelIds.includes(channel.id);
          return (
            <div
              key={channel.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Hash className="h-4 w-4 text-zinc-500 shrink-0" />
                <span className="text-sm text-zinc-300 truncate">{channel.name}</span>
              </div>
              <Switch
                checked={isSelected}
                onCheckedChange={(checked) => onToggle(channel.id, checked)}
              />
            </div>
          );
        })}
      </div>

      {selectedChannelIds.length > 0 && (
        <p className="text-xs text-zinc-500 pt-2">
          {selectedChannelIds.length} channel{selectedChannelIds.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  );
}
