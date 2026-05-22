import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenManager } from '../../packages/gr-client/src/auth.js';

describe('TokenManager', () => {
  let manager: TokenManager;

  beforeEach(() => {
    manager = new TokenManager({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      oauthUrl: 'https://iam-oauth2.globalrelay.com/oauth2/token',
    });
  });

  it('fetches a token and caches it', async () => {
    const fakeResponse = {
      access_token: 'abc123',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid conversation file write',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeResponse),
    });

    const token = await manager.getToken();
    expect(token).toBe('abc123');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const token2 = await manager.getToken();
    expect(token2).toBe('abc123');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refetches when token is expired', async () => {
    const fakeResponse1 = {
      access_token: 'token-old',
      expires_in: 0,
      token_type: 'Bearer',
      scope: 'openid conversation file write',
    };
    const fakeResponse2 = {
      access_token: 'token-new',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid conversation file write',
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeResponse1) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeResponse2) });

    const token1 = await manager.getToken();
    expect(token1).toBe('token-old');

    const token2 = await manager.getToken();
    expect(token2).toBe('token-new');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
