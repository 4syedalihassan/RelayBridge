'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FormData {
  name: string;
  description: string;
  discordServerId: string;
  discordChannelIds: string;
  grClientId: string;
  grClientSecret: string;
  grOAuthUrl: string;
  grApiBaseUrl: string;
}

interface ConnectorResponse {
  id: string;
  name: string;
  description: string | null;
  discordServerId: string;
  discordChannelIds: string;
  grClientId: string;
  grClientSecret: string;
  grOAuthUrl: string;
  grApiBaseUrl: string;
  enabled: boolean;
  status: string;
  lastHealthCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConnectorFormProps {
  connector: {
    id: string;
    name: string;
    description?: string | null;
    discordServerId: string;
    discordChannelIds: string;
    grClientId: string;
    grClientSecret: string;
    grOAuthUrl: string;
    grApiBaseUrl: string;
  };
  onSave: (updatedConnector: ConnectorResponse) => void;
  onCancel: () => void;
}

const TABS = ['Config', 'Discord', 'Credentials'] as const;

type Tab = (typeof TABS)[number];

export function ConnectorForm({ connector, onSave, onCancel }: ConnectorFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Config');
  const [formData, setFormData] = useState<FormData>({
    name: connector.name,
    description: connector.description ?? '',
    discordServerId: connector.discordServerId,
    discordChannelIds: connector.discordChannelIds,
    grClientId: connector.grClientId,
    grClientSecret: connector.grClientSecret,
    grOAuthUrl: connector.grOAuthUrl,
    grApiBaseUrl: connector.grApiBaseUrl,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const requiredFields: (keyof FormData)[] = ['name', 'grClientId', 'grClientSecret'];

  const isValid = requiredFields.every((f) => formData[f].trim() !== '');

  const handleSave = async () => {
    if (!isValid) {
      setError('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await fetchApi<ConnectorResponse>(`/api/connectors/${connector.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          discordServerId: formData.discordServerId,
          discordChannelIds: formData.discordChannelIds,
          grClientId: formData.grClientId,
          grClientSecret: formData.grClientSecret,
          grOAuthUrl: formData.grOAuthUrl,
          grApiBaseUrl: formData.grApiBaseUrl,
        }),
      });
      setSuccess(true);
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connector');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm w-full';

  const labelClass = 'text-sm text-zinc-400 mb-1 block';

  return (
    <div className="space-y-4">
      <div className="flex border-b border-zinc-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-white text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-2 rounded-md text-sm">
          Connector saved successfully.
        </div>
      )}

      <div className="space-y-4">
        {activeTab === 'Config' && (
          <>
            <div>
              <label className={labelClass}>Name *</label>
              <input
                className={fieldClass}
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                className={cn(fieldClass, 'min-h-[80px]')}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
          </>
        )}

        {activeTab === 'Discord' && (
          <>
            <div>
              <label className={labelClass}>Discord Server ID</label>
              <input
                className={cn(fieldClass, 'opacity-60 cursor-not-allowed')}
                value={formData.discordServerId}
                readOnly
              />
              <p className="text-xs text-zinc-600 mt-1">
                Server ID cannot be changed after creation.
              </p>
            </div>
            <div>
              <label className={labelClass}>Discord Channel IDs</label>
              <input
                className={fieldClass}
                value={formData.discordChannelIds}
                onChange={(e) => updateField('discordChannelIds', e.target.value)}
                placeholder="Comma-separated channel IDs"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Separate multiple IDs with commas.
              </p>
            </div>
          </>
        )}

        {activeTab === 'Credentials' && (
          <>
            <div>
              <label className={labelClass}>Client ID *</label>
              <input
                className={fieldClass}
                value={formData.grClientId}
                onChange={(e) => updateField('grClientId', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Client Secret *</label>
              <input
                type="password"
                className={fieldClass}
                value={formData.grClientSecret}
                onChange={(e) => updateField('grClientSecret', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>OAuth URL</label>
              <input
                className={fieldClass}
                value={formData.grOAuthUrl}
                onChange={(e) => updateField('grOAuthUrl', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>API Base URL</label>
              <input
                className={fieldClass}
                value={formData.grApiBaseUrl}
                onChange={(e) => updateField('grApiBaseUrl', e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
