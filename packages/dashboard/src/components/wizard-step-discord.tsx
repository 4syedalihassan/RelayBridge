'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface WizardStepDiscordProps {
  hasAuthed: boolean;
  onAuth: () => void;
  connectedGuildName: string | null;
}

export function WizardStepDiscord({ hasAuthed, onAuth, connectedGuildName }: WizardStepDiscordProps) {
  if (hasAuthed) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-700 bg-green-950/30">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-300">Connected to Discord</p>
            {connectedGuildName && (
              <p className="text-sm text-zinc-400">
                Authenticated as member of <span className="text-zinc-300">{connectedGuildName}</span>
              </p>
            )}
          </div>
          <Badge variant="success">Authorized</Badge>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-400">
            Discord OAuth is authorized. Proceed to select a server and channels for archiving.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-indigo-600/20 flex items-center justify-center">
          <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        </div>
        <div>
          <p className="text-base font-medium text-white">Connect to Discord</p>
          <p className="text-sm text-zinc-400 mt-1">
            Authorize with your Discord account to browse servers and select channels for archiving.
          </p>
        </div>
        <Button onClick={onAuth} size="lg">
          Connect to Discord
        </Button>
      </div>
    </div>
  );
}
