'use client';

import { useEffect, useState } from 'react';
import { ServerCard } from '@/components/server-card';
import { fetchApi } from '@/lib/api';

interface Server {
  id: string;
  name: string;
  icon?: string;
  archivingEnabled?: boolean;
}

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<Server[]>('/api/servers')
      .then(setServers)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (serverId: string, enabled: boolean) => {
    await fetchApi('/api/config', {
      method: 'PATCH',
      body: JSON.stringify({ serverId, archivingEnabled: enabled }),
    });
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, archivingEnabled: enabled } : s)),
    );
  };

  if (loading) return <p className="text-zinc-400">Loading servers...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Servers</h1>
        <p className="text-zinc-400 mt-1">Toggle archiving per Discord server</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            id={server.id}
            name={server.name}
            iconUrl={server.icon ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : null}
            archivingEnabled={server.archivingEnabled ?? false}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}
