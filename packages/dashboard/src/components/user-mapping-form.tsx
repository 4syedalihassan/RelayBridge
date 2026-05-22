'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';

interface UserMappingFormProps {
  serverId: string;
  onSaved: () => void;
}

export function UserMappingForm({ serverId, onSaved }: UserMappingFormProps) {
  const [discordUserId, setDiscordUserId] = useState('');
  const [discordName, setDiscordName] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchApi(`/api/servers/${serverId}/users`, {
        method: 'POST',
        body: JSON.stringify({ discordUserId, discordName, corporateEmail }),
      });
      setDiscordUserId('');
      setDiscordName('');
      setCorporateEmail('');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <input
          placeholder="Discord User ID"
          className="px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
          value={discordUserId}
          onChange={(e) => setDiscordUserId(e.target.value)}
          required
        />
        <input
          placeholder="Discord Display Name"
          className="px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
          value={discordName}
          onChange={(e) => setDiscordName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Corporate Email"
          className="px-3 py-2 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm"
          value={corporateEmail}
          onChange={(e) => setCorporateEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Add Mapping'}
      </Button>
    </form>
  );
}
