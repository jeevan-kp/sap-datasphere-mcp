import { TokenManager } from '../auth/token-manager.js';
import type { DatasphereConfig } from '../types/index.js';

export class DatasphereClient {
  private tokenManager: TokenManager;
  private baseUrl: string;

  constructor(config: DatasphereConfig) {
    this.baseUrl = config.baseUrl;
    this.tokenManager = new TokenManager(
      config.tokenUrl,
      config.clientId,
      config.clientSecret
    );
  }

  private async request(
    method: string,
    path: string,
    body?: object
  ): Promise<unknown> {
    const token = await this.tokenManager.getToken();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Datasphere-MCP-Server/1.0',
      'Accept': 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      this.tokenManager.revoke();
      return this.request(method, path, body);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API request failed: ${response.status} ${text}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  async get(path: string): Promise<unknown> {
    return this.request('GET', path);
  }

  async post(path: string, body: object): Promise<unknown> {
    return this.request('POST', path, body);
  }

  async put(path: string, body: object): Promise<unknown> {
    return this.request('PUT', path, body);
  }

  async delete(path: string): Promise<unknown> {
    return this.request('DELETE', path);
  }

  async listSpaces(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/spaces');
  }

  async getSpaceInfo(spaceId: string): Promise<unknown> {
    return this.get(`/api/v1/datasphere/consumption/catalog/spaces('${encodeURIComponent(spaceId)}')`);
  }

  async listCatalogAssets(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/assets');
  }

  async getCatalogAsset(spaceId: string, assetId: string): Promise<unknown> {
    return this.get(
      `/api/v1/datasphere/consumption/catalog/assets/${encodeURIComponent(spaceId)}.${encodeURIComponent(assetId)}`
    );
  }

  async listConnections(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/connections');
  }

  async getMetadata(spaceId: string, assetId: string): Promise<unknown> {
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}/$metadata`
    );
  }

  async queryRelational(
    spaceId: string,
    assetId: string,
    params: Record<string, string>
  ): Promise<unknown> {
    const query = new URLSearchParams(params).toString();
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}?${query}`
    );
  }

  async queryAnalytical(
    spaceId: string,
    assetId: string,
    params: Record<string, string>
  ): Promise<unknown> {
    const query = new URLSearchParams(params).toString();
    return this.get(
      `/api/v1/datasphere/consumption/analytical/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}?${query}`
    );
  }
}
