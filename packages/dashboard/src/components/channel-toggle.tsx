import { Switch } from '@/components/ui/switch';
import { Hash } from 'lucide-react';

interface ChannelToggleProps {
  id: string;
  name: string;
  archivingEnabled: boolean;
  onToggle: (channelId: string, enabled: boolean) => void;
}

export function ChannelToggle({ id, name, archivingEnabled, onToggle }: ChannelToggleProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-zinc-500" />
        <span className="text-sm text-zinc-300">{name}</span>
      </div>
      <Switch
        checked={archivingEnabled}
        onCheckedChange={(checked) => onToggle(id, checked)}
      />
    </div>
  );
}
