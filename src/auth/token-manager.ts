import type { OAuthToken } from '../types/index.js';

import { sanitizeForLLM } from '../security/sanitizer.js';

export class TokenManager {
  private token: OAuthToken | null = null;
  private refreshBufferMs = 60000;

  constructor(
    private tokenUrl: string,
    private clientId: string,
    private clientSecret: string
  ) {}

  async getToken(): Promise<string> {
    if (this.token && !this.isExpired()) {
      return this.token.accessToken;
    }
    return this.acquireToken();
  }

  private isExpired(): boolean {
    if (!this.token) return true;
    return Date.now() >= this.token.expiresAt - this.refreshBufferMs;
  }

  private async acquireToken(): Promise<string> {
    // SAP official: Authorization: Basic base64(client_id:client_secret) per CLI docs p10 + Mario's connector
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basic}`,
      },
      body: body.toString(),
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`OAuth token request failed: ${response.status} ${sanitizeForLLM(text.slice(0, 300))}`);
    }

    if (!contentType.includes('application/json')) {
      throw new Error(
        `OAuth endpoint returned status ${response.status} with non-JSON content-type "${contentType}". ` +
        `Please verify DATASPHERE_TOKEN_URL in your .env.`
      );
    }

    let data: {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('OAuth token response is not valid JSON. Please verify DATASPHERE_TOKEN_URL.');
    }

    this.token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
    };

    return this.token.accessToken;
  }

  revoke(): void {
    this.token = null;
  }
}
