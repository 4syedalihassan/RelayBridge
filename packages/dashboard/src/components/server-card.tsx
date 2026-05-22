import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface ServerCardProps {
  id: string;
  name: string;
  iconUrl?: string | null;
  archivingEnabled: boolean;
  onToggle: (serverId: string, enabled: boolean) => void;
}

export function ServerCard({ id, name, iconUrl, archivingEnabled, onToggle }: ServerCardProps) {
  return (
    <Link href={`/dashboard/servers/${id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {iconUrl ? (
              <img src={iconUrl} alt={name} className="h-10 w-10 rounded-full" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold">
                {name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-white">{name}</p>
              <p className="text-xs text-zinc-500">{id}</p>
            </div>
          </div>
          <div onClick={(e) => e.preventDefault()}>
            <Switch
              checked={archivingEnabled}
              onCheckedChange={(checked) => onToggle(id, checked)}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
