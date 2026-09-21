import { TokenManager } from '../auth/token-manager.js';
import type { DatasphereConfig } from '../types/index.js';
import { sanitizeForLLM, extractCorrelationId } from '../security/sanitizer.js';
import { logger } from '../utils/logger.js';
import { globalCircuitBreaker } from '../utils/circuit-breaker.js';

export class DatasphereApiError extends Error {
  code: number;
  statusCode: number;
  correlationId?: string;

  constructor(message: string, code: number, statusCode: number, correlationId?: string) {
    super(message);
    this.name = 'DatasphereApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.correlationId = correlationId;
  }
}

export class DatasphereClient {
  private tokenManager: TokenManager;
  private baseUrl: string;

  constructor(config: DatasphereConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
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
    // Normalise path to ensure leading slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}${normalizedPath}`;

    // PRE-DISPATCH GUARD (Work Order §3.6): Reject any path containing '//' after protocol
    const pathOnly = url.replace(/^https?:\/\/[^/]+/, '');
    if (pathOnly.includes('//')) {
      const err = new DatasphereApiError(
        `Invalid request path: Contains double slash ('//') in '${pathOnly}'`,
        -32602,
        400
      );
      throw err;
    }

    // Circuit breaker check (Work Order §3.8)
    const targetKey = `${method}:${pathOnly.split('?')[0]}`;
    globalCircuitBreaker.check(targetKey);

    // Log outgoing URL before dispatch (Work Order §10 item 4)
    logger.logOutgoingRequest({
      method,
      outgoingUrl: url,
    });

    const token = await this.tokenManager.getToken();
    const startTime = Date.now();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Datasphere-MCP-Server/1.0',
      'Accept': 'application/json',
      'Accept-Language': 'en',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr: any) {
      const durationMs = Date.now() - startTime;
      logger.logOutgoingResponse({
        outgoingUrl: url,
        statusCode: 0,
        durationMs,
        error: networkErr?.message || 'Network fetch failed',
      });
      globalCircuitBreaker.recordFailure(targetKey);
      const err = new DatasphereApiError(
        `Upstream connection failed: ${networkErr?.message || 'Network error'}`,
        -32001,
        504
      );
      throw err;
    }

    const durationMs = Date.now() - startTime;
    let correlationId = extractCorrelationId(undefined, response.headers);

    if (response.status === 401 && !isRetry) {
      this.tokenManager.revoke();
      return this.request(method, path, body, true);
    }

    if (!response.ok) {
      const text = await response.text();
      if (!correlationId) {
        correlationId = extractCorrelationId(text);
      }

      logger.logOutgoingResponse({
        outgoingUrl: url,
        statusCode: response.status,
        durationMs,
        correlationId,
        error: text.slice(0, 300),
      });

      globalCircuitBreaker.recordFailure(targetKey, correlationId);

      // Map HTTP status to MCP JSON-RPC protocol error codes (Work Order §7.3)
      let rpcCode = -32603; // Default Internal Error / 5xx
      if (response.status === 400 || response.status === 422) {
        rpcCode = -32602; // Invalid params
      } else if (response.status === 404) {
        rpcCode = -32602; // Asset not found
      } else if (response.status === 401 || response.status === 403) {
        rpcCode = -32002; // Not authorised
      } else if (response.status === 413) {
        rpcCode = -32083; // Result too large
      } else if (response.status === 408 || response.status === 504) {
        rpcCode = -32001; // Upstream timeout
      }

      const sanitized = sanitizeForLLM(text);
      const err = new DatasphereApiError(
        `API request failed: ${response.status} ${sanitized}`,
        rpcCode,
        response.status,
        correlationId
      );
      throw err;
    }

    // Record success in circuit breaker
    globalCircuitBreaker.recordSuccess(targetKey);

    logger.logOutgoingResponse({
      outgoingUrl: url,
      statusCode: response.status,
      durationMs,
      correlationId,
    });

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
    const cleanSpace = (spaceId || '').trim();
    if (!cleanSpace) {
      throw new DatasphereApiError('Invalid params: space_id is required', -32602, 400);
    }
    try {
      return await this.get(`/api/v1/datasphere/consumption/catalog/spaces('${encodeURIComponent(cleanSpace)}')`);
    } catch {
      // Fallback to searching the space in the catalog spaces list
      const allSpaces = await this.listSpaces() as { value?: Array<{ name: string; label: string }> };
      const match = allSpaces?.value?.find(s => s.name === cleanSpace || s.label === cleanSpace);
      if (match) {
        return match;
      }
      throw new DatasphereApiError(`Space "${cleanSpace}" not found in Datasphere catalog`, -32602, 404);
    }
  }

  async getCatalogRoot(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog');
  }

  async listCatalogAssets(): Promise<unknown> {
    return this.get('/api/v1/datasphere/consumption/catalog/assets');
  }

  async getAssetByCompoundId(assetCompoundId: string): Promise<unknown> {
    const cleanId = (assetCompoundId || '').trim();
    if (!cleanId) {
      throw new DatasphereApiError('Invalid params: asset compound ID is required', -32602, 400);
    }
    return this.get(`/api/v1/datasphere/consumption/catalog/assets(${encodeURIComponent(cleanId)})`);
  }

  async getCatalogAsset(spaceId: string, assetId: string): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    const cleanAsset = (assetId || '').trim();
    if (!cleanSpace || !cleanAsset) {
      throw new DatasphereApiError('Invalid params: space_id and asset_id are required', -32602, 400);
    }
    try {
      return await this.get(
        `/api/v1/datasphere/consumption/catalog/spaces('${encodeURIComponent(cleanSpace)}')/assets('${encodeURIComponent(cleanAsset)}')`
      );
    } catch {
      // Fallback: query assets filtered by spaceName and asset name
      const res = await this.get(
        `/api/v1/datasphere/consumption/catalog/assets?$filter=spaceName eq '${encodeURIComponent(cleanSpace)}' and name eq '${encodeURIComponent(cleanAsset)}'`
      ) as { value?: unknown[] };
      if (res?.value && res.value.length > 0) {
        return res.value[0];
      }
      throw new DatasphereApiError(`Asset "${cleanAsset}" not found in space "${cleanSpace}"`, -32602, 404);
    }
  }

  async getSpaceAssets(spaceId: string): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    if (!cleanSpace) {
      throw new DatasphereApiError('Invalid params: space_id is required', -32602, 400);
    }
    return this.get(
      `/api/v1/datasphere/consumption/catalog/assets?$filter=spaceName eq '${encodeURIComponent(cleanSpace)}'`
    );
  }

  async listConnections(spaceId?: string): Promise<unknown> {
    const targetSpace = (spaceId || 'FTDWH_100_INT').trim();
    try {
      return await this.get(`/api/v1/datasphere/spaces/${encodeURIComponent(targetSpace)}/connections`);
    } catch {
      return await this.get(`/dwaas-core/api/v1/spaces/${encodeURIComponent(targetSpace)}/connections`);
    }
  }

  async getMetadata(spaceId: string, assetId: string): Promise<unknown> {
    return this.getRelationalMetadata(spaceId, assetId);
  }

  async queryRelational(
    spaceId: string,
    assetId: string,
    entityName?: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    let cleanAsset = (assetId || '').trim();
    let cleanEntity = (entityName || '').trim();

    if (!cleanSpace) {
      throw new DatasphereApiError('Invalid params: space_id is required', -32602, 400);
    }

    // Default entity_name to asset_id or vice-versa to prevent empty segment //
    if (!cleanAsset && cleanEntity) cleanAsset = cleanEntity;
    if (!cleanEntity && cleanAsset) cleanEntity = cleanAsset;

    if (!cleanAsset || !cleanEntity) {
      throw new DatasphereApiError('Invalid params: asset_id or entity_name is required', -32602, 400);
    }

    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const suffix = query ? `?${query}` : '';
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(cleanSpace)}/${encodeURIComponent(cleanAsset)}/${encodeURIComponent(cleanEntity)}${suffix}`
    );
  }

  async listRelationalEntities(spaceId: string, assetId: string): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    const cleanAsset = (assetId || '').trim();
    if (!cleanSpace || !cleanAsset) {
      throw new DatasphereApiError('Invalid params: space_id and asset_id are required', -32602, 400);
    }
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(cleanSpace)}/${encodeURIComponent(cleanAsset)}`
    );
  }

  async getRelationalMetadata(spaceId: string, assetId: string): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    const cleanAsset = (assetId || '').trim();
    if (!cleanSpace || !cleanAsset) {
      throw new DatasphereApiError('Invalid params: space_id and asset_id are required', -32602, 400);
    }
    return this.get(
      `/api/v1/datasphere/consumption/relational/${encodeURIComponent(cleanSpace)}/${encodeURIComponent(cleanAsset)}/$metadata`
    );
  }

  async queryAnalytical(
    spaceId: string,
    assetId: string,
    entitySet: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    let cleanAsset = (assetId || '').trim();
    let cleanEntity = (entitySet || '').trim();

    if (!cleanSpace) {
      throw new DatasphereApiError('Invalid params: space_id is required', -32602, 400);
    }
    if (!cleanAsset && cleanEntity) cleanAsset = cleanEntity;
    if (!cleanEntity && cleanAsset) cleanEntity = cleanAsset;

    if (!cleanAsset || !cleanEntity) {
      throw new DatasphereApiError('Invalid params: asset_id or entity_set is required', -32602, 400);
    }

    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const suffix = query ? `?${query}` : '';
    return this.get(
      `/api/v1/datasphere/consumption/analytical/${encodeURIComponent(cleanSpace)}/${encodeURIComponent(cleanAsset)}/${encodeURIComponent(cleanEntity)}${suffix}`
    );
  }

  async getAnalyticalServiceDocument(spaceId: string, assetId: string): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    const cleanAsset = (assetId || '').trim();
    if (!cleanSpace || !cleanAsset) {
      throw new DatasphereApiError('Invalid params: space_id and asset_id are required', -32602, 400);
    }
    return this.get(
      `/api/v1/datasphere/consumption/analytical/${encodeURIComponent(cleanSpace)}/${encodeURIComponent(cleanAsset)}`
    );
  }

  async getAnalyticalMetadata(spaceId: string, assetId: string): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    const cleanAsset = (assetId || '').trim();
    if (!cleanSpace || !cleanAsset) {
      throw new DatasphereApiError('Invalid params: space_id and asset_id are required', -32602, 400);
    }
    return this.get(
      `/api/v1/datasphere/consumption/analytical/${encodeURIComponent(cleanSpace)}/${encodeURIComponent(cleanAsset)}/$metadata`
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
    const cleanSpace = (spaceId || '').trim();
    const cleanLog = (logId || '').trim();
    if (!cleanSpace || !cleanLog) {
      throw new DatasphereApiError('Invalid params: space_id and log_id are required', -32602, 400);
    }
    return this.get(`/api/v1/datasphere/tasks/logs/${encodeURIComponent(cleanSpace)}/${encodeURIComponent(cleanLog)}`);
  }

  async getTaskHistory(spaceId: string, objectId: string): Promise<unknown> {
    const cleanSpace = (spaceId || '').trim();
    const cleanObj = (objectId || '').trim();
    if (!cleanSpace || !cleanObj) {
      throw new DatasphereApiError('Invalid params: space_id and object_id are required', -32602, 400);
    }
    return this.get(`/api/v1/datasphere/tasks/logs/${encodeURIComponent(cleanSpace)}/objects/${encodeURIComponent(cleanObj)}`);
  }
}
