'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChannelToggle } from '@/components/channel-toggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserMappingForm } from '@/components/user-mapping-form';
import { fetchApi } from '@/lib/api';

interface Channel {
  id: string;
  name: string;
  type: number;
  archivingEnabled?: boolean;
}

function UserMappingSection({ serverId }: { serverId: string }) {
  const [mappings, setMappings] = useState<Array<{ id: string; discordName: string; corporateEmail: string }>>([]);

  const loadMappings = async () => {
    const data = await fetchApi<Array<{ id: string; discordName: string; corporateEmail: string }>>(`/api/servers/${serverId}/users`);
    setMappings(data);
  };

  useEffect(() => { loadMappings(); }, [serverId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white">User → Email Mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UserMappingForm serverId={serverId} onSaved={loadMappings} />
        {mappings.length > 0 && (
          <div className="space-y-2 mt-4">
            {mappings.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between text-sm p-2 bg-zinc-900 rounded-md">
                <span className="text-zinc-300">{m.discordName}</span>
                <span className="text-zinc-500">{m.corporateEmail}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ServerDetailPage() {
  const params = useParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('');

  useEffect(() => {
    fetch(`/api/servers/${params.id}/channels`)
      .then((r) => r.json())
      .then((data) => {
        setChannels(data.channels ?? []);
        setServerName(data.name ?? 'Unknown');
      });
  }, [params.id]);

  const textChannels = channels.filter((c) => c.type === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">{serverName}</h1>
        <p className="text-zinc-400 mt-1">Manage channel-level archiving</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            Text Channels
            <Badge variant="secondary">{textChannels.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {textChannels.map((ch) => (
              <ChannelToggle
                key={ch.id}
                id={ch.id}
                name={ch.name}
                archivingEnabled={ch.archivingEnabled ?? false}
                onToggle={(channelId, enabled) => {
                  setChannels((prev) =>
                    prev.map((c) => (c.id === channelId ? { ...c, archivingEnabled: enabled } : c)),
                  );
                }}
              />
            ))}
            {textChannels.length === 0 && (
              <p className="text-zinc-500 text-sm">No text channels found</p>
            )}
          </div>
        </CardContent>
      </Card>

      <UserMappingSection serverId={params.id as string} />
    </div>
  );
}
