import { type GrArchiveRequest, type GrArchiveResponse } from '@discord-gr/core';
import { TokenManager } from './auth.js';

export class GrClient {
  private baseUrl: string;
  private tokenManager: TokenManager;
  private maxRetries: number = 3;
  private rateLimitRpm: number;
  private requestTimestamps: number[] = [];

  constructor(baseUrl: string, tokenManager: TokenManager, rateLimitRpm: number = 900) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.tokenManager = tokenManager;
    this.rateLimitRpm = rateLimitRpm;
  }

  async archiveConversation(payload: GrArchiveRequest): Promise<GrArchiveResponse> {
    await this.waitForRateLimit();

    const token = await this.tokenManager.getToken();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/conversations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after')) || 1;
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`GR API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json() as GrArchiveResponse;
        this.requestTimestamps.push(Date.now());
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError ?? new Error('Unknown GR client error');
  }

  async uploadFile(fileKey: string, fileBuffer: ArrayBuffer, contentType: string): Promise<void> {
    await this.waitForRateLimit();
    const token = await this.tokenManager.getToken();

    const response = await fetch(`${this.baseUrl}/files/${fileKey}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GR file upload error ${response.status}: ${errorBody}`);
    }

    this.requestTimestamps.push(Date.now());
  }

  private async waitForRateLimit(): Promise<void> {
    const windowMs = 60_000;
    const now = Date.now();

    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < windowMs);

    if (this.requestTimestamps.length >= this.rateLimitRpm) {
      const oldest = this.requestTimestamps[0];
      const waitMs = windowMs - (now - oldest) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
