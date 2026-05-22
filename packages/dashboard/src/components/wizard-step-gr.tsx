'use client';

import { cn } from '@/lib/utils';

export interface WizardStepGrProps {
  grClientId: string;
  grClientSecret: string;
  grOAuthUrl: string;
  grApiBaseUrl: string;
  onChange: (field: 'grClientId' | 'grClientSecret' | 'grOAuthUrl' | 'grApiBaseUrl', value: string) => void;
  errors: Partial<Record<'grClientId' | 'grClientSecret', string>>;
}

export function WizardStepGr({
  grClientId,
  grClientSecret,
  grOAuthUrl,
  grApiBaseUrl,
  onChange,
  errors,
}: WizardStepGrProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="gr-client-id" className="text-sm font-medium text-zinc-300">
          Client ID <span className="text-red-500">*</span>
        </label>
        <input
          id="gr-client-id"
          type="text"
          value={grClientId}
          onChange={(e) => onChange('grClientId', e.target.value)}
          placeholder="Your Global Relay client ID"
          className={cn(
            'flex h-10 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950',
            errors.grClientId
              ? 'border-red-500 focus:ring-red-500'
              : 'border-zinc-700 focus:ring-zinc-500',
          )}
        />
        {errors.grClientId && (
          <p className="text-sm text-red-500">{errors.grClientId}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="gr-client-secret" className="text-sm font-medium text-zinc-300">
          Client Secret <span className="text-red-500">*</span>
        </label>
        <input
          id="gr-client-secret"
          type="password"
          value={grClientSecret}
          onChange={(e) => onChange('grClientSecret', e.target.value)}
          placeholder="Your Global Relay client secret"
          className={cn(
            'flex h-10 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950',
            errors.grClientSecret
              ? 'border-red-500 focus:ring-red-500'
              : 'border-zinc-700 focus:ring-zinc-500',
          )}
        />
        {errors.grClientSecret && (
          <p className="text-sm text-red-500">{errors.grClientSecret}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="gr-oauth-url" className="text-sm font-medium text-zinc-300">
          OAuth URL
        </label>
        <input
          id="gr-oauth-url"
          type="text"
          value={grOAuthUrl}
          onChange={(e) => onChange('grOAuthUrl', e.target.value)}
          className={cn(
            'flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950',
          )}
        />
        <p className="text-xs text-zinc-500">Default OAuth2 token endpoint for Global Relay.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="gr-api-base-url" className="text-sm font-medium text-zinc-300">
          API Base URL
        </label>
        <input
          id="gr-api-base-url"
          type="text"
          value={grApiBaseUrl}
          onChange={(e) => onChange('grApiBaseUrl', e.target.value)}
          className={cn(
            'flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950',
          )}
        />
        <p className="text-xs text-zinc-500">Base URL for the Global Relay Conversations API.</p>
      </div>
    </div>
  );
}
