'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { WizardStepName } from '@/components/wizard-step-name';
import { WizardStepDiscord } from '@/components/wizard-step-discord';
import { WizardStepServer, type DiscordServer } from '@/components/wizard-step-server';
import { WizardStepChannels, type DiscordChannel } from '@/components/wizard-step-channels';
import { WizardStepGr } from '@/components/wizard-step-gr';
import { WizardStepReview, type WizardData } from '@/components/wizard-step-review';

const STEP_LABELS = ['Name', 'Discord', 'Server', 'Channels', 'Credentials', 'Review'] as const;

const MOCK_SERVERS: DiscordServer[] = [
  { id: '123456789012345678', name: 'Engineering Team', memberCount: 42 },
  { id: '234567890123456789', name: 'Support Guild', memberCount: 156 },
  { id: '345678901234567890', name: 'Community Hub', memberCount: 1280 },
];

const MOCK_CHANNELS: DiscordChannel[] = [
  { id: '111111111111111111', name: 'general' },
  { id: '222222222222222222', name: 'announcements' },
  { id: '333333333333333333', name: 'support-tickets' },
  { id: '444444444444444444', name: 'dev-chat' },
  { id: '555555555555555555', name: 'random' },
  { id: '666666666666666666', name: 'meeting-notes' },
];

export interface ConnectorWizardProps {
  initialData?: Partial<WizardData>;
}

function buildInitialState(initialData: Partial<WizardData> | undefined): WizardData {
  return {
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    hasAuthed: initialData?.hasAuthed ?? false,
    connectedGuildName: initialData?.connectedGuildName ?? null,
    selectedServerId: initialData?.selectedServerId ?? '',
    selectedChannelIds: initialData?.selectedChannelIds ?? [],
    grClientId: initialData?.grClientId ?? '',
    grClientSecret: initialData?.grClientSecret ?? '',
    grOAuthUrl: initialData?.grOAuthUrl ?? 'https://iam-oauth2.globalrelay.com/oauth2/token',
    grApiBaseUrl: initialData?.grApiBaseUrl ?? 'https://conversations.api.globalrelay.com/v2',
  };
}

export function ConnectorWizard({ initialData }: ConnectorWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(() => buildInitialState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof WizardData>(field: K, value: WizardData[K]) => {
      setWizardData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const validateCurrentStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 0: {
        if (!wizardData.name.trim()) {
          newErrors.name = 'Connector name is required.';
        }
        break;
      }
      case 1: {
        if (!wizardData.hasAuthed) {
          newErrors.auth = 'You must connect to Discord first.';
        }
        break;
      }
      case 2: {
        if (!wizardData.selectedServerId) {
          newErrors.server = 'Please select a server.';
        }
        break;
      }
      case 3: {
        if (wizardData.selectedChannelIds.length === 0) {
          newErrors.channels = 'Select at least one channel.';
        }
        break;
      }
      case 4: {
        if (!wizardData.grClientId.trim()) {
          newErrors.grClientId = 'Client ID is required.';
        }
        if (!wizardData.grClientSecret.trim()) {
          newErrors.grClientSecret = 'Client Secret is required.';
        }
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, wizardData]);

  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    setCurrentStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
  }, [validateCurrentStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setErrors({});
  }, []);

  const handleEdit = useCallback((step: number) => {
    setCurrentStep(step);
    setErrors({});
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validateCurrentStep()) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const response = await fetch('/api/connectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: wizardData.name.trim(),
            description: wizardData.description.trim() || undefined,
            discordServerId: wizardData.selectedServerId,
            discordChannelIds: wizardData.selectedChannelIds.join(','),
            grClientId: wizardData.grClientId.trim(),
            grClientSecret: wizardData.grClientSecret.trim(),
            grOAuthUrl: wizardData.grOAuthUrl.trim(),
            grApiBaseUrl: wizardData.grApiBaseUrl.trim(),
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Server responded with ${response.status}: ${body}`);
        }

        const created: { id: string } = await response.json();
        router.push(`/dashboard/connectors/${created.id}`);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to create connector.');
      } finally {
        setSubmitting(false);
      }
    },
    [wizardData, validateCurrentStep, router],
  );

  const authError = currentStep === 1 ? errors.auth : undefined;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Connector</CardTitle>
      </CardHeader>

      <CardContent>
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8">
          {STEP_LABELS.map((label, idx) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium shrink-0',
                  idx < currentStep
                    ? 'bg-indigo-600 text-white'
                    : idx === currentStep
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500'
                      : 'bg-zinc-800 text-zinc-500',
                )}
              >
                {idx < currentStep ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  'text-xs hidden sm:inline',
                  idx <= currentStep ? 'text-zinc-300' : 'text-zinc-600',
                )}
              >
                {label}
              </span>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    'h-px flex-1 mx-1',
                    idx < currentStep ? 'bg-indigo-600' : 'bg-zinc-800',
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <form onSubmit={handleSubmit}>
          {currentStep === 0 && (
            <WizardStepName
              name={wizardData.name}
              description={wizardData.description}
              onChange={(field, value) => updateField(field, value)}
              errors={{ name: errors.name }}
            />
          )}

          {currentStep === 1 && (
            <WizardStepDiscord
              hasAuthed={wizardData.hasAuthed}
              onAuth={() => {
                updateField('hasAuthed', true);
                updateField('connectedGuildName', 'Engineering Team');
              }}
              connectedGuildName={wizardData.connectedGuildName}
            />
          )}

          {currentStep === 2 && (
            <WizardStepServer
              servers={MOCK_SERVERS}
              selectedServerId={wizardData.selectedServerId}
              onSelect={(id) => updateField('selectedServerId', id)}
            />
          )}

          {currentStep === 3 && (
            <WizardStepChannels
              channels={MOCK_CHANNELS}
              selectedChannelIds={wizardData.selectedChannelIds}
              onToggle={(channelId, enabled) => {
                setWizardData((prev) => ({
                  ...prev,
                  selectedChannelIds: enabled
                    ? [...prev.selectedChannelIds, channelId]
                    : prev.selectedChannelIds.filter((id) => id !== channelId),
                }));
              }}
            />
          )}

          {currentStep === 4 && (
            <WizardStepGr
              grClientId={wizardData.grClientId}
              grClientSecret={wizardData.grClientSecret}
              grOAuthUrl={wizardData.grOAuthUrl}
              grApiBaseUrl={wizardData.grApiBaseUrl}
              onChange={(field, value) => updateField(field, value)}
              errors={{ grClientId: errors.grClientId, grClientSecret: errors.grClientSecret }}
            />
          )}

          {currentStep === 5 && (
            <WizardStepReview
              data={wizardData}
              servers={MOCK_SERVERS}
              channels={MOCK_CHANNELS}
              onEdit={handleEdit}
            />
          )}

          {/* Submit error */}
          {submitError && (
            <div className="mt-4 p-3 rounded-md bg-red-950/50 border border-red-800">
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </Button>

            <div className="flex items-center gap-2">
              {currentStep < STEP_LABELS.length - 1 && (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              )}
              {currentStep === STEP_LABELS.length - 1 && (
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Connector'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
