import type { GrArchiveResponse } from '@discord-gr/core';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export async function fetchConfig(): Promise<{
  clientId: string;
  clientSecret: string;
  oauthUrl: string;
  apiBaseUrl: string;
}> {
  return fetchApi('/api/config');
}

export async function updateConfig(data: {
  clientId: string;
  clientSecret?: string;
  oauthUrl?: string;
  apiBaseUrl?: string;
}): Promise<void> {
  await fetchApi('/api/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchServers(): Promise<Array<{
  id: string;
  name: string;
  iconUrl: string | null;
  archivingEnabled: boolean;
  channelCount: number;
}>> {
  return fetchApi('/api/servers');
}

export async function fetchStatus(): Promise<{
  bridgeRunning: boolean;
  totalArchived: number;
  queueLength: number;
}> {
  return fetchApi('/api/status');
}
