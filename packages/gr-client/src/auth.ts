export interface TokenManagerOptions {
  clientId: string;
  clientSecret: string;
  oauthUrl: string;
}

export class TokenManager {
  private token: string | null = null;
  private expiresAt: number = 0;
  private options: TokenManagerOptions;

  constructor(options: TokenManagerOptions) {
    this.options = options;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }

    const credentials = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64');

    const response = await fetch(this.options.oauthUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'openid conversation file write',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Global Relay OAuth failed: ${response.status} — ${errorBody}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    this.token = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.token!;
  }

  reset(): void {
    this.token = null;
    this.expiresAt = 0;
  }
}
