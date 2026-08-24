import type { OAuthToken } from '../types/index.js';

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
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth token request failed: ${response.status} ${text}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

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
