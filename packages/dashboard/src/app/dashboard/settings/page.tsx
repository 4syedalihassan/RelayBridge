'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';

interface GrConfig {
  clientId: string;
  clientSecret: string;
  oauthUrl: string;
  apiBaseUrl: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<GrConfig>({
    clientId: '',
    clientSecret: '',
    oauthUrl: 'https://iam-oauth2.globalrelay.com/oauth2/token',
    apiBaseUrl: 'https://conversations.api.globalrelay.com/v2',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchApi<GrConfig>('/api/config').then(setConfig).catch(() => {});
  }, []);

  const handleSave = async () => {
    await fetchApi('/api/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Global Relay API configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Global Relay Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Client ID</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.clientId}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">Client Secret</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.clientSecret}
              onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">OAuth URL</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.oauthUrl}
              onChange={(e) => setConfig({ ...config, oauthUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">API Base URL</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
              value={config.apiBaseUrl}
              onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
            />
          </div>

          <Button onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
