import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GrClient } from '../client.js';
import { TokenManager } from '../auth.js';

describe('GrClient', () => {
  let client: GrClient;
  let mockTokenManager: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockTokenManager = { getToken: vi.fn().mockResolvedValue('test-token') };
    client = new GrClient(
      'https://conversations.api.globalrelay.com/v2',
      mockTokenManager as unknown as TokenManager,
      900,
    );
  });

  it('sends archive request with auth header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reconciliationId: 'rec-123', status: 'success' }),
    });

    const payload = {
      conversationOverview: { externalConversationId: 'test', conversationType: 'multi' as const, initialParticipants: [] },
      conversationEvents: [{ eventTime: Date.now(), eventType: 'Message' as const, participants: [{ displayName: 'Tester', userType: 'initiator' as const }] }],
    };

    const result = await client.archiveConversation(payload);

    expect(result.reconciliationId).toBe('rec-123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://conversations.api.globalrelay.com/v2/conversations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('retries on 429 rate limit', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Map([['retry-after', '1']]), text: () => Promise.resolve('') })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reconciliationId: 'rec-456', status: 'success' }),
      });

    const payload = {
      conversationOverview: { externalConversationId: 'test', conversationType: 'multi' as const, initialParticipants: [] },
      conversationEvents: [{ eventTime: Date.now(), eventType: 'Message' as const, participants: [{ displayName: 'Tester', userType: 'initiator' as const }] }],
    };

    const result = await client.archiveConversation(payload);
    expect(result.reconciliationId).toBe('rec-456');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, 15000);
});
