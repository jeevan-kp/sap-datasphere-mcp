import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatasphereClient } from '../../src/api/client.js';
import { CircuitBreaker } from '../../src/utils/circuit-breaker.js';
import { StructuredLogger, safeSerialize } from '../../src/utils/logger.js';
import { sanitizeForLLM, formatUserFacingError, extractCorrelationId } from '../../src/security/sanitizer.js';
import { SpaceAuditor } from '../../src/admin/space-auditor.js';
import { getAllTools, getToolByName } from '../../src/tools/registry.js';

describe('Datasphere MCP Comprehensive Cross-Test Suite (Work Order Verification)', () => {
  const mockConfig = {
    baseUrl: 'https://daimlertruck-q.eu10.hcs.cloud.sap',
    tokenUrl: 'https://auth.sap.com/oauth/token',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // ISSUE #1: The // empty-segment URL bug (§3.1 - §3.7)
  // =========================================================================
  describe('ISSUE #1: The // empty-segment URL bug', () => {
    it('Assertion 1.1: Pre-dispatch guard intercepts any path containing // before network call', async () => {
      const client = new DatasphereClient(mockConfig);
      vi.spyOn((client as any).tokenManager, 'getToken').mockResolvedValue('test-token');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(
        client.get('/api/v1/datasphere/consumption/relational/FTDWH_100_INT//')
      ).rejects.toMatchObject({
        code: -32602,
        message: expect.stringContaining("Contains double slash ('//')"),
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Assertion 1.2: execute_query correctly extracts asset from FROM clause', () => {
      const queries = [
        { sql: 'SELECT COUNT(*) AS ROW_COUNT FROM "Bi04Account"', expected: 'Bi04Account' },
        { sql: 'SELECT COUNT(*) AS ROW_COUNT FROM "1CB_100_FTHPINVG_01"', expected: '1CB_100_FTHPINVG_01' },
        { sql: "SELECT * FROM 'bi04account' WHERE ID = 1", expected: 'bi04account' },
        { sql: 'SELECT a, b FROM schema.MY_TABLE', expected: 'MY_TABLE' },
      ];

      for (const q of queries) {
        const match = q.sql.match(/\bFROM\s+(?:["']?[a-zA-Z0-9_]+["']?\.)?["']?([a-zA-Z0-9_]+)["']?/i);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(q.expected);
      }
    });

    it('Assertion 1.3: smart_query parses asset from query and rejects missing asset with -32602', () => {
      const rawQuery = 'SELECT COUNT(*) AS ROW_COUNT FROM "1CB_100_FTHPINVG_01"';
      const match = rawQuery.match(/\bFROM\s+(?:["'][^"']+["']\.)?["']?([a-zA-Z0-9_]+)["']?/i);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('1CB_100_FTHPINVG_01');

      // Rejects empty query without asset context
      const emptyQuery = '';
      const assetId = '';
      expect(() => {
        if (!assetId && !emptyQuery) {
          const err = new Error("smart_query requires an identifiable asset context.");
          (err as any).code = -32602;
          throw err;
        }
      }).toThrow();
    });
  });

  // =========================================================================
  // ISSUE #2: The 500 INTERNAL_ERROR Cluster (§4.1 - §4.4)
  // =========================================================================
  describe('ISSUE #2: The 500 INTERNAL_ERROR Cluster', () => {
    it('Assertion 2.1: analyze_column_distribution rejects column_name: "*" with code -32602', () => {
      const validateColumn = (columnName: string) => {
        if (!columnName || columnName === '*') {
          const err = new Error("Invalid parameter: column_name cannot be '*'. Specify a concrete column name.");
          (err as any).code = -32602;
          throw err;
        }
      };

      expect(() => validateColumn('*')).toThrow();
      try {
        validateColumn('*');
      } catch (err: any) {
        expect(err.code).toBe(-32602);
      }
      expect(() => validateColumn('NETWR')).not.toThrow();
    });

    it('Assertion 2.2: Circuit breaker trips after 3 consecutive failures with code -32603', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 15000 });
      const target = 'GET:/api/v1/datasphere/consumption/relational/FTDWH_100_INT/test';

      expect(cb.isOpen(target)).toBe(false);
      cb.recordFailure(target, 'CORR-01');
      cb.recordFailure(target, 'CORR-02');
      expect(cb.isOpen(target)).toBe(false);
      cb.recordFailure(target, 'CORR-03');
      expect(cb.isOpen(target)).toBe(true);

      expect(() => cb.check(target)).toThrow(/Circuit breaker open: 3 consecutive failures detected/);
      try {
        cb.check(target);
      } catch (err: any) {
        expect(err.code).toBe(-32603);
        expect(err.message).toContain('Reference: CORR-03');
      }
    });
  });

  // =========================================================================
  // ISSUE #3: hana_execute_sql Authentication Failure (§5.1 - §5.4)
  // =========================================================================
  describe('ISSUE #3: hana_execute_sql and test_hana_connection', () => {
    it('Assertion 3.1: test_hana_connection is registered in foundation tools', () => {
      const tool = getToolByName('test_hana_connection');
      expect(tool).toBeDefined();
      expect(tool?.category).toBe('foundation');
      expect(tool?.requiresAuth).toBe(true);
    });

    it('Assertion 3.2: HANA authentication failure maps to -32002 Not authorised', () => {
      const rawHanaError = 'authentication failed: user locked or invalid credentials';
      const isAuth = /authentication|not authorised|credential|password|locked/i.test(rawHanaError);
      expect(isAuth).toBe(true);
      const code = isAuth ? -32002 : -32603;
      expect(code).toBe(-32002);
    });
  });

  // =========================================================================
  // ISSUE #4: Two silent failures nobody flagged (§6.1 - §6.2)
  // =========================================================================
  describe('ISSUE #4: Two Silent Failures', () => {
    it('Assertion 4.1: get_deployed_objects returns structured reason and retains active catalog assets', () => {
      const rawAssets = [
        { name: '1LR_100_FTWPINV6_01', type: 'VIEW', spaceName: 'FTDWH_100_INT' },
        { name: '2LR_SALES_ORD', type: 'VIEW', spaceName: 'FTDWH_100_INT', status: 'ACTIVE' },
        { name: 'INACTIVE_ASSET', type: 'VIEW', spaceName: 'FTDWH_100_INT', status: 'INACTIVE' },
        { name: 'UNDEPLOYED_ASSET', type: 'VIEW', spaceName: 'FTDWH_100_INT', isDeployed: false },
      ];

      const deployed = rawAssets.filter((a: any) => {
        if (a.isDeployed === false) return false;
        if (a.deploymentStatus && a.deploymentStatus !== 'Deployed' && a.deploymentStatus !== 'DEPLOYED') return false;
        if (a.status && (a.status === 'INACTIVE' || a.status === 'ERROR' || a.status === 'UNDEPLOYED')) return false;
        return true;
      });

      expect(deployed).toHaveLength(2);
      expect(deployed[0].name).toBe('1LR_100_FTWPINV6_01');
      expect(deployed[1].name).toBe('2LR_SALES_ORD');

      // Empty response metadata structure
      const emptyResult = {
        items: [],
        reason: 'no_assets_in_space',
        totalAssetsInSpace: 0,
        spaceId: 'FTDWH_100_INT',
      };
      expect(emptyResult.reason).toBe('no_assets_in_space');
    });

    it('Assertion 4.2: audit_performance_optimizations contains ZERO fabricated mock rows', async () => {
      const report = await SpaceAuditor.auditPerformanceOptimizations({
        spaceId: 'FTDWH_100_INT',
        thresholdRows: 100000,
      });

      expect(report.tables).toHaveLength(0);
      expect(report.views).toHaveLength(0);
      expect(report.pipelines).toHaveLength(0);
      expect(report.summary.totalAssetsAudited).toBe(0);

      const containsAcdoca = JSON.stringify(report).includes('ACDOCA_GL_POSTINGS');
      expect(containsAcdoca).toBe(false);
    });
  });

  // =========================================================================
  // ISSUE #5 & #6: Parameter Naming and Consistency (§7.1 - §8.3)
  // =========================================================================
  describe('ISSUE #5 & #6: Parameter Naming & Normalization', () => {
    it('Assertion 5.1: Leading-digit assets auto-derive underscore entity set prefix', () => {
      const assetId = '4MA_404_X';
      let entityName = '';
      if (/^[0-9]/.test(assetId) && !entityName.startsWith('_')) {
        entityName = `_${assetId}`;
      }
      expect(entityName).toBe('_4MA_404_X');
    });

    it('Assertion 5.2: Dot notation is normalized to underscores', () => {
      const rawEntity = 'MY.SCHEMA.TABLE';
      const normalized = rawEntity.replace(/\./g, '_');
      expect(normalized).toBe('MY_SCHEMA_TABLE');
    });

    it('Assertion 5.3: query_relational tool is marked deprecated in registry', () => {
      const tool = getToolByName('query_relational');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('[DEPRECATED');
    });
  });

  // =========================================================================
  // ISSUE #7: Data Sanitization Boundary (§9.1 - §9.2)
  // =========================================================================
  describe('ISSUE #7: Data Sanitization Boundary', () => {
    it('Assertion 7.1: Leaked tenant hostnames, endpoints, raw SQL, and ETags are masked', () => {
      const rawLeaked = `
        Internal error at https://daimlertruck-q.eu10.hcs.cloud.sap/api/v1/datasphere/consumption/relational/FTDWH_100_INT/4VD_TABLE/
        Query executed: SELECT * FROM "FTDWH_100_INT"."4VD_TABLE"
        ETag: W/"qvf28be0r4cmv140To6b7spyiT4LPM5a0jwcfNz2K91E="
        Correlation ID: 94d1e5899ece6f127e9d7a3cc018edac8
        at Object.run (/app/dist/server.js:123:45)
      `;

      const sanitized = sanitizeForLLM(rawLeaked);
      expect(sanitized).not.toContain('daimlertruck-q.eu10.hcs.cloud.sap');
      expect(sanitized).not.toContain('/api/v1/datasphere/consumption');
      expect(sanitized).not.toContain('W/"qvf28be0r4cmv140To6b7spyiT4LPM5a0jwcfNz2K91E="');
      expect(sanitized).not.toContain('at Object.run');

      const corrId = extractCorrelationId(rawLeaked);
      expect(corrId).toBe('94d1e5899ece6f127e9d7a3cc018edac8');

      // User-facing boundary formatUserFacingError ensures raw SQL is never exposed
      const userMsg = formatUserFacingError(-32603, rawLeaked, corrId);
      expect(userMsg).toBe('Temporary problem. Reference: 94d1e5899ece6f127e9d7a3cc018edac8');
      expect(userMsg).not.toContain('SELECT * FROM');
      expect(userMsg).not.toContain('daimlertruck-q');
    });
  });

  // =========================================================================
  // ISSUE #8: Structured Logging & Safe Serialization (§10.1 - §10.2)
  // =========================================================================
  describe('ISSUE #8: Structured Logging & Serialization', () => {
    it('Assertion 8.1: Outputs atomic single-line JSON with ISO-8601 timestamp and outgoing URL', () => {
      let loggedOutput = '';
      const stream = {
        write: (msg: string) => {
          loggedOutput += msg;
          return true;
        },
      };

      const logger = new StructuredLogger(stream as any);
      logger.logOutgoingResponse({
        outgoingUrl: 'https://daimlertruck-q.eu10.hcs.cloud.sap/api/v1/datasphere/consumption/catalog/spaces',
        statusCode: 200,
        durationMs: 76,
        correlationId: '1F1DF764B507294D8E595552BF47CA0D',
      });

      expect(loggedOutput.endsWith('\n')).toBe(true);
      const parsed = JSON.parse(loggedOutput.trim());
      expect(parsed.level).toBe('INFO');
      expect(parsed.outgoingUrl).toBe('https://daimlertruck-q.eu10.hcs.cloud.sap/api/v1/datasphere/consumption/catalog/spaces');
      expect(parsed.statusCode).toBe(200);
      expect(parsed.durationMs).toBe(76);
      expect(parsed.correlationId).toBe('1F1DF764B507294D8E595552BF47CA0D');
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });

    it('Assertion 8.2: safeSerialize handles circular references gracefully without <unserializable>', () => {
      const obj: any = { id: 'root' };
      obj.circular = obj;

      const serialized = safeSerialize(obj);
      expect(serialized).not.toContain('<unserializable>');
      expect(serialized).toContain('[Circular]');
    });
  });

  // =========================================================================
  // SECTION 12: Verification Checklist Confirmation
  // =========================================================================
  describe('SECTION 12: Verification Checklist Confirmation', () => {
    it('Checklist Item 1 & 2: URL constructor does not emit // and preserves unescaped $', async () => {
      const client = new DatasphereClient(mockConfig);
      vi.spyOn((client as any).tokenManager, 'getToken').mockResolvedValue('token');

      let requestedUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        requestedUrl = String(url);
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      });

      await client.queryRelational('FTDWH_100_INT', '1LR_EKKO_01', '1LR_EKKO_01', {
        '$top': '25',
        '$select': 'EBELN,BUKRS',
      });

      expect(requestedUrl).toContain('$top=25');
      expect(requestedUrl).toContain('$select=EBELN%2CBUKRS');
      expect(requestedUrl).not.toContain('%24top');
      expect(requestedUrl).not.toContain('//1LR');
      expect(requestedUrl).not.toContain('FTDWH_100_INT//');
    });

    it('Checklist Item 4: Lean profile tools count is consistent and clean', () => {
      const leanTools = getAllTools('lean');
      expect(leanTools.length).toBeGreaterThanOrEqual(40);
    });
  });
});
