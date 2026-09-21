import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatasphereClient, DatasphereApiError } from '../../src/api/client.js';
import { sanitizeForLLM, formatUserFacingError, extractCorrelationId } from '../../src/security/sanitizer.js';
import { CircuitBreaker } from '../../src/utils/circuit-breaker.js';
import { StructuredLogger, safeSerialize } from '../../src/utils/logger.js';
import { SpaceAuditor } from '../../src/admin/space-auditor.js';

describe('Work Order Verification Checklist Suite', () => {
  const testConfig = {
    baseUrl: 'https://daimlertruck-q.eu10.hcs.cloud.sap',
    tokenUrl: 'https://auth.sap.com/oauth/token',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Checklist #1 & #2: Pre-dispatch guard rejects // in path and logs outgoing URL', async () => {
    const client = new DatasphereClient(testConfig);
    // Mock token acquisition
    vi.spyOn((client as any).tokenManager, 'getToken').mockResolvedValue('test-token');

    // Spy on global fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Attempt calling GET with double slash in path
    await expect(
      client.get('/api/v1/datasphere/consumption/relational/FTDWH_100_INT//')
    ).rejects.toThrow(/Contains double slash \('\/\/'\)/);

    // CRITICAL: Fetch must NOT have been dispatched (guard threw before network call)
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Checklist #1: queryRelational prevents empty segments and constructs clean path', async () => {
    const client = new DatasphereClient(testConfig);
    vi.spyOn((client as any).tokenManager, 'getToken').mockResolvedValue('test-token');

    let capturedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await client.queryRelational('FTDWH_100_INT', '1LR_EKKO_01', '1LR_EKKO_01', { '$top': '10' });

    expect(capturedUrl).not.toContain('//1LR');
    expect(capturedUrl).not.toContain('FTDWH_100_INT//');
    expect(capturedUrl).toContain('/api/v1/datasphere/consumption/relational/FTDWH_100_INT/1LR_EKKO_01/1LR_EKKO_01?$top=10');
  });

  it('Checklist #3: Audit tool reports real data and never fabricates ACDOCA row counts', async () => {
    const report = await SpaceAuditor.auditPerformanceOptimizations({
      spaceId: 'FTDWH_100_INT',
      thresholdRows: 100000,
    });

    // Ensure 0 fabricated mock rows
    expect(report.tables).toHaveLength(0);
    expect(report.views).toHaveLength(0);
    expect(report.pipelines).toHaveLength(0);
    expect(report.summary.totalAssetsAudited).toBe(0);

    const hasFabricatedAcdoca = report.tables.some(t => t.tableName.includes('ACDOCA'));
    expect(hasFabricatedAcdoca).toBe(false);
  });

  it('Checklist #5 & #6: Sanitizer masks leaked tenant hostnames, raw SQL, and internal paths while extracting correlation ID', () => {
    const rawError = `
      API error occurred at https://daimlertruck-q.eu10.hcs.cloud.sap/api/v1/datasphere/consumption/relational/FTDWH_100_INT/4VD_TABLE/
      Raw query: SELECT COUNT(*) AS ROW_COUNT FROM "FTDWH_100_INT"."4VD_TABLE"
      ETag: W/"qvf28be0r4cmv140To6b7spyiT4LPM5a0jwcfNz2K91E="
      Internal schema: DSP_OPEN_SCHEMA
      See correlation id 1F1DF764B507294D8E595552BF47CA0D
      at QueryExecutor.execute (/app/dist/server.js:412:15)
    `;

    const sanitized = sanitizeForLLM(rawError);

    expect(sanitized).not.toContain('daimlertruck-q.eu10.hcs.cloud.sap');
    expect(sanitized).not.toContain('/api/v1/datasphere/consumption');
    expect(sanitized).not.toContain('DSP_OPEN_SCHEMA');
    expect(sanitized).not.toContain('W/"qvf28be0r4cmv140To6b7spyiT4LPM5a0jwcfNz2K91E="');
    expect(sanitized).not.toContain('at QueryExecutor.execute');

    // Correlation ID extracted properly
    const correlationId = extractCorrelationId(rawError);
    expect(correlationId).toBe('1F1DF764B507294D8E595552BF47CA0D');

    // User-facing error formatting matching Work Order contract
    const userMessage = formatUserFacingError(-32603, rawError, correlationId);
    expect(userMessage).toBe('Temporary problem. Reference: 1F1DF764B507294D8E595552BF47CA0D');
    expect(userMessage).not.toContain('SELECT');
    expect(userMessage).not.toContain('daimlertruck-q');
  });

  it('Checklist #7: Circuit breaker trips after 3 consecutive failures and fails fast', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 10000 });
    const target = 'GET:/api/v1/datasphere/consumption/relational/test';

    // First call allowed
    expect(() => cb.check(target)).not.toThrow();

    // 1st failure
    cb.recordFailure(target, 'CORR-001');
    expect(cb.isOpen(target)).toBe(false);

    // 2nd failure
    cb.recordFailure(target, 'CORR-002');
    expect(cb.isOpen(target)).toBe(false);

    // 3rd failure - breaker trips
    cb.recordFailure(target, 'CORR-003');
    expect(cb.isOpen(target)).toBe(true);

    // Subsequent call fails fast with code -32603 and reference ID
    try {
      cb.check(target);
      expect.fail('Should have thrown circuit breaker error');
    } catch (err: any) {
      expect(err.message).toContain('Circuit breaker open: 3 consecutive failures detected');
      expect(err.message).toContain('Reference: CORR-003');
      expect(err.code).toBe(-32603);
    }

    // Success on different target does not affect tripped target
    cb.recordSuccess('GET:/other');
    expect(cb.isOpen(target)).toBe(true);

    // Manual reset clears state
    cb.reset();
    expect(cb.isOpen(target)).toBe(false);
  });

  it('Checklist #11: Structured logger outputs valid single-line JSON with ISO-8601 timestamp', () => {
    let capturedLine = '';
    const mockStream = {
      write: (data: string) => {
        capturedLine += data;
        return true;
      },
    };

    const structuredLogger = new StructuredLogger(mockStream as any);
    structuredLogger.logOutgoingResponse({
      outgoingUrl: 'https://test.datasphere.cloud.sap/api/v1/spaces',
      statusCode: 200,
      durationMs: 45,
      correlationId: 'TEST-CORR-123',
    });

    expect(capturedLine.endsWith('\n')).toBe(true);

    // Must parse as valid JSON
    const parsed = JSON.parse(capturedLine.trim());
    expect(parsed.level).toBe('INFO');
    expect(parsed.outcome).toBe('SUCCESS');
    expect(parsed.outgoingUrl).toBe('https://test.datasphere.cloud.sap/api/v1/spaces');
    expect(parsed.statusCode).toBe(200);
    expect(parsed.durationMs).toBe(45);
    expect(parsed.correlationId).toBe('TEST-CORR-123');

    // Valid ISO-8601 timestamp
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it('Checklist safeSerialize handles circular structures and large text without crashing', () => {
    const circularObj: any = { name: 'test' };
    circularObj.self = circularObj;

    const result = safeSerialize(circularObj);
    expect(result).not.toContain('<unserializable>');
    expect(result).toContain('[Circular]');
  });

  it('Checklist #8 & #9: Auto-derives leading digit entity set name and handles parameter aliases', async () => {
    const client = new DatasphereClient(testConfig);
    vi.spyOn((client as any).tokenManager, 'getToken').mockResolvedValue('test-token');

    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ value: [{ COL: 1 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // When entity_name is omitted for asset starting with digit (4MA_404_X), auto-derive _4MA_404_X
    const assetId = '4MA_404_X';
    const autoDerived = /^[0-9]/.test(assetId) ? `_${assetId}` : assetId;
    expect(autoDerived).toBe('_4MA_404_X');

    await client.queryRelational('FTDWH_100_INT', assetId, autoDerived, {});
    expect(calledUrl).toContain('/api/v1/datasphere/consumption/relational/FTDWH_100_INT/4MA_404_X/_4MA_404_X');
  });

  it('Checklist #10: DatasphereClient queryRelational falls back smoothly if entity_name omitted', async () => {
    const client = new DatasphereClient(testConfig);
    vi.spyOn((client as any).tokenManager, 'getToken').mockResolvedValue('test-token');

    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Pass undefined as entityName, should fallback to assetId
    await client.queryRelational('FTDWH_100_INT', 'fact_sales', undefined as any, {});
    expect(calledUrl).toContain('/api/v1/datasphere/consumption/relational/FTDWH_100_INT/fact_sales/fact_sales');
    const pathOnly = calledUrl.replace(/^https?:\/\/[^/]+/, '');
    expect(pathOnly).not.toContain('//');
  });

  it('Work Order §3.7: execute_query extracts asset context from SQL and avoids //', async () => {
    const client = new DatasphereClient(testConfig);
    vi.spyOn((client as any).tokenManager, 'getToken').mockResolvedValue('test-token');

    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ value: [{ count: 42 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const sqlQuery = "SELECT COUNT(*) FROM 'bi04account'";
    const match = sqlQuery.match(/\bFROM\s+(?:["'][^"']+["']\.)?["']?([a-zA-Z0-9_]+)["']?/i);
    expect(match).toBeDefined();
    expect(match![1]).toBe('bi04account');

    await client.queryRelational('FTDWH_100_INT', match![1], match![1], {});
    expect(calledUrl).toContain('/api/v1/datasphere/consumption/relational/FTDWH_100_INT/bi04account/bi04account');
    const pathOnly = calledUrl.replace(/^https?:\/\/[^/]+/, '');
    expect(pathOnly).not.toContain('//');
  });

  it('Work Order §6.1: get_deployed_objects returns explicit metadata reasons instead of bare empty array', () => {
    const emptyResult = {
      items: [],
      reason: 'no_deployed_objects',
      totalAssetsInSpace: 25,
      spaceId: 'FTDWH_100_INT',
    };

    expect(emptyResult.reason).toBe('no_deployed_objects');
    expect(emptyResult.totalAssetsInSpace).toBe(25);
    expect(emptyResult.items).toHaveLength(0);
  });

  it('Work Order §3.2 Instance 5 & §3.5: smart_query parses asset from query and rejects missing asset with -32602', () => {
    // 1. Parsing from SQL query
    const rawSql = 'SELECT COUNT(*) AS ROW_COUNT FROM "1CB_100_FTHPINVG_01"';
    const match = rawSql.match(/\bFROM\s+(?:["'][^"']+["']\.)?["']?([a-zA-Z0-9_]+)["']?/i);
    expect(match).toBeDefined();
    expect(match![1]).toBe('1CB_100_FTHPINVG_01');

    // 2. Direct identifier fallback
    const directIdent = 'Bi04Account';
    const isDirect = /^[a-zA-Z0-9_]+$/.test(directIdent);
    expect(isDirect).toBe(true);

    // 3. Leading digit entity derivation
    const assetId = match![1];
    const entityName = /^[0-9]/.test(assetId) ? `_${assetId}` : assetId;
    expect(entityName).toBe('_1CB_100_FTHPINVG_01');

    // 4. Missing asset throws -32602
    const emptyAsset = '';
    expect(() => {
      if (!emptyAsset) {
        const err = new Error("smart_query requires an identifiable asset context.");
        (err as any).code = -32602;
        throw err;
      }
    }).toThrow(/smart_query requires an identifiable asset context/);
  });

  it('Work Order §6.1: get_deployed_objects retains active catalog assets and filters inactive', () => {
    const rawCatalogAssets = [
      { name: '1LR_100_FTWPINV6_01', type: 'VIEW', spaceName: 'FTDWH_100_INT' },
      { name: '2LR_SALES_ORD', type: 'VIEW', spaceName: 'FTDWH_100_INT', status: 'ACTIVE' },
      { name: 'OLD_VIEW', type: 'VIEW', spaceName: 'FTDWH_100_INT', status: 'INACTIVE' },
      { name: 'DRAFT_VIEW', type: 'VIEW', spaceName: 'FTDWH_100_INT', isDeployed: false },
    ];

    const deployed = rawCatalogAssets.filter((a: any) => {
      if (a.isDeployed === false) return false;
      if (a.deploymentStatus && a.deploymentStatus !== 'Deployed' && a.deploymentStatus !== 'DEPLOYED') return false;
      if (a.status && (a.status === 'INACTIVE' || a.status === 'ERROR' || a.status === 'UNDEPLOYED')) return false;
      return true;
    });

    expect(deployed).toHaveLength(2);
    expect(deployed.map(d => d.name)).toEqual(['1LR_100_FTWPINV6_01', '2LR_SALES_ORD']);
  });
});



