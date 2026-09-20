import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatasphereClient } from '../../src/api/client.js';

describe('DatasphereClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries once on 401 and stops without infinite recursion', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('/oauth/token')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({
            access_token: 'dummy-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        };
      }
      return {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized with secret_token_data',
        headers: new Headers(),
      };
    }));

    const client = new DatasphereClient({
      baseUrl: 'https://test.datasphere.cloud.sap',
      tokenUrl: 'https://test.authentication.cloud.sap/oauth/token',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      tenantId: 'test-tenant',
      cliHost: 'https://test.datasphere.cloud.sap',
    });

    await expect(client.listSpaces()).rejects.toThrow('API request failed: 401');
    expect(callCount).toBeLessThanOrEqual(5);
  });
});
