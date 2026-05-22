'use client';

import { cn } from '@/lib/utils';

export interface WizardStepNameProps {
  name: string;
  description: string;
  onChange: (field: 'name' | 'description', value: string) => void;
  errors: Partial<Record<'name' | 'description', string>>;
}

export function WizardStepName({ name, description, onChange, errors }: WizardStepNameProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="connector-name" className="text-sm font-medium text-zinc-300">
          Connector Name <span className="text-red-500">*</span>
        </label>
        <input
          id="connector-name"
          type="text"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g., Compliance Archive - Server 1"
          className={cn(
            'flex h-10 w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950',
            errors.name
              ? 'border-red-500 focus:ring-red-500'
              : 'border-zinc-700 focus:ring-zinc-500',
          )}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="connector-description" className="text-sm font-medium text-zinc-300">
          Description <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="connector-description"
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Brief description of this connector's purpose"
          rows={4}
          className={cn(
            'flex w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950 resize-none',
          )}
        />
      </div>
    </div>
  );
}
