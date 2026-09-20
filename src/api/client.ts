import { TokenManager } from '../auth/token-manager.js';
import type { DatasphereConfig } from '../types/index.js';
import { sanitizeForLLM } from '../security/sanitizer.js';

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
    body?: object,
    isRetry = false
  ): Promise<unknown> {
    const token = await this.tokenManager.getToken();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Datasphere-MCP-Server/1.0',
      'Accept': 'application/json',
      'Accept-Language': 'en',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && !isRetry) {
      this.tokenManager.revoke();
      return this.request(method, path, body, true);
    }

    if (!response.ok) {
      const text = await response.text();
      const sanitized = sanitizeForLLM(text);
      throw new Error(`API request failed: ${response.status} ${sanitized}`);
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
    try {
      return await this.get(`/api/v1/datasphere/consumption/catalog/spaces('${encodeURIComponent(spaceId)}')`);
    } catch {
      // Fallback to searching the space in the catalog spaces list
      const allSpaces = await this.listSpaces() as { value?: Array<{ name: string; label: string }> };
      const match = allSpaces?.value?.find(s => s.name === spaceId || s.label === spaceId);
      if (match) {
        return match;
      }
      throw new Error(`Space "${spaceId}" not found in Datasphere catalog`);
    }
  }

  async getCatalogRoot(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog');
  }

  async listCatalogAssets(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/assets');
  }

  async getAssetByCompoundId(assetCompoundId: string): Promise<unknown> {
    return this.get(`/api/v1/datasphere/consumption/catalog/assets(${encodeURIComponent(assetCompoundId)})`);
  }

  async getCatalogAsset(spaceId: string, assetId: string): Promise<unknown> {
    try {
      return await this.get(
        `/api/v1/datasphere/consumption/catalog/spaces('${encodeURIComponent(spaceId)}')/assets('${encodeURIComponent(assetId)}')`
      );
    } catch {
      // Fallback: query assets filtered by spaceName and asset name
      const res = await this.get(
        `/api/v1/datasphere/consumption/catalog/assets?$filter=spaceName eq '${encodeURIComponent(spaceId)}' and name eq '${encodeURIComponent(assetId)}'`
      ) as { value?: unknown[] };
      if (res?.value && res.value.length > 0) {
        return res.value[0];
      }
      throw new Error(`Asset "${assetId}" not found in space "${spaceId}"`);
    }
  }

  async getSpaceAssets(spaceId: string): Promise<unknown> {
    return this.get(
      `/api/v1/datasphere/consumption/catalog/assets?$filter=spaceName eq '${encodeURIComponent(spaceId)}'`
    );
  }

  async listConnections(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/connections');
  }

  async getMetadata(spaceId: string, assetId: string): Promise<unknown> {
    return this.getRelationalMetadata(spaceId, assetId);
  }

  async queryRelational(
    spaceId: string,
    assetId: string,
    entityName: string,
    params: Record<string, string>
  ): Promise<unknown> {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}/${encodeURIComponent(entityName)}${suffix}`
    );
  }

  async listRelationalEntities(spaceId: string, assetId: string): Promise<unknown> {
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}`
    );
  }

  async getRelationalMetadata(spaceId: string, assetId: string): Promise<unknown> {
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}/$metadata`
    );
  }

  async queryAnalytical(
    spaceId: string,
    assetId: string,
    entitySet: string,
    params: Record<string, string>
  ): Promise<unknown> {
    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return this.get(
      `/api/v1/datasphere/consumption/analytical/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}/${encodeURIComponent(entitySet)}${suffix}`
    );
  }

  async getAnalyticalServiceDocument(spaceId: string, assetId: string): Promise<unknown> {
    return this.get(
      `/api/v1/datasphere/consumption/analytical/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}`
    );
  }

  async getAnalyticalMetadata(spaceId: string, assetId: string): Promise<unknown> {
    return this.get(
      `/api/v1/datasphere/consumption/analytical/${encodeURIComponent(spaceId)}/${encodeURIComponent(assetId)}/$metadata`
    );
  }

  async getCatalogMetadata(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/$metadata');
  }

  async getConsumptionMetadata(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/$metadata');
  }

  async searchCatalog(keyword: string): Promise<unknown> {
    return this.get(`/api/v1/datasphere/consumption/catalog/assets?search=${encodeURIComponent(keyword)}`);
  }

  async getTaskLog(spaceId: string, logId: string): Promise<unknown> {
    return this.get(`/api/v1/datasphere/tasks/logs/${encodeURIComponent(spaceId)}/${encodeURIComponent(logId)}`);
  }

  async getTaskHistory(spaceId: string, objectId: string): Promise<unknown> {
    return this.get(`/api/v1/datasphere/tasks/logs/${encodeURIComponent(spaceId)}/objects/${encodeURIComponent(objectId)}`);
  }
}
