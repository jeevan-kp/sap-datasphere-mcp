import { describe, it, expect } from 'vitest';
import { SpaceAuditor } from '../../src/admin/space-auditor.js';

describe('SpaceAuditor - Space Administrator Suite', () => {
  it('computes space health score and detects faults', async () => {
    const mockClient = {
      getSpaceAssets: async () => ({
        value: [
          { name: 'TABLE_A', label: 'Customer Staging Table', type: 'TABLE' },
          { name: '4VD_SUPPLIER', label: '', type: 'VIEW' }, // Digit prefix + missing label
          { name: 'TABLE_C', label: 'TABLE_C', type: 'TABLE' }, // Missing label
        ],
      }),
      listTaskChains: async () => ({
        value: [
          { name: 'TC_SALES_LOAD', status: 'FAILED' },
          { name: 'TC_FIN_LOAD', status: 'SUCCESS' },
        ],
      }),
    };

    const report = await SpaceAuditor.auditSpaceHealth({
      spaceId: 'FTDWH_100_INT',
      client: mockClient,
    });

    expect(report).toBeDefined();
    expect(report.spaceId).toBe('FTDWH_100_INT');
    expect(report.metrics.totalAssets).toBe(3);
    expect(report.metrics.taskChains).toBe(2);
    expect(report.overallHealthScore).toBeLessThan(100);

    // Verify faults detected
    const criticalFault = report.faults.find(f => f.severity === 'CRITICAL');
    expect(criticalFault).toBeDefined();
    expect(criticalFault?.description).toContain('TC_SALES_LOAD');

    const digitInfo = report.faults.find(f => f.assetName === '4VD_SUPPLIER' && f.category === 'SCHEMA');
    expect(digitInfo).toBeDefined();
  });

  it('audits table health and identifies missing primary keys and documentation', async () => {
    const report = await SpaceAuditor.auditTableHealth({
      spaceId: 'FTDWH_100_INT',
      tableName: 'SALES_STAGE',
    });

    expect(report).toBeDefined();
    expect(report.tableName).toBe('SALES_STAGE');
    expect(report.hasPrimaryKey).toBe(true);
    expect(report.totalColumns).toBeGreaterThan(0);
    expect(report.documentationCoveragePct).toBeDefined();
  });

  it('suggests table documentation with Before and After diff based on SAP context dictionary', () => {
    const cols = ['VBELN', 'POSNR', 'KUNNR', 'NETWR', 'WAERK', 'ZZ_CUSTOM_REGION'];
    const diff = SpaceAuditor.suggestDocumentation('VBAP_SALES_ITEMS', cols);

    expect(diff).toBeDefined();
    expect(diff.suggestedTableLabel).toContain('Sales Document Item');
    expect(diff.columns).toHaveLength(6);

    const vbeln = diff.columns.find(c => c.columnName === 'VBELN');
    expect(vbeln?.suggestedLabel).toBe('Sales Document Number');
    expect(vbeln?.confidence).toBe('HIGH');

    const netwr = diff.columns.find(c => c.columnName === 'NETWR');
    expect(netwr?.suggestedLabel).toBe('Net Transaction Amount');

    const custom = diff.columns.find(c => c.columnName === 'ZZ_CUSTOM_REGION');
    expect(custom?.suggestedLabel).toContain('Custom Extension');

    // Verify CSN patch preview
    expect(diff.csnPatchPreview).toBeDefined();
    expect((diff.csnPatchPreview as any).definitions.VBAP_SALES_ITEMS).toBeDefined();
  });

  it('reports real state with 0 assets when no live data is present and does not fabricate mock data', async () => {
    const report = await SpaceAuditor.auditPerformanceOptimizations({
      spaceId: 'FTDWH_100_INT',
      thresholdRows: 100000,
    });

    expect(report).toBeDefined();
    expect(report.spaceId).toBe('FTDWH_100_INT');
    expect(report.tables).toHaveLength(0);
    expect(report.views).toHaveLength(0);
    expect(report.pipelines).toHaveLength(0);
    expect(report.summary.totalAssetsAudited).toBe(0);
    expect(report.summary.criticalBottlenecks).toBe(0);
    expect(report.summary.overallOptimizationScore).toBe(100);

    // Confirm NO fabricated ACDOCA_GL_POSTINGS or fake pipelines appear
    const acdoca = report.tables.find(t => t.tableName.includes('ACDOCA'));
    expect(acdoca).toBeUndefined();
    expect(report.recommendationSummary[0]).toContain('No physical tables or views');
  });

  it('audits performance optimizations when live HANA data is provided', async () => {
    const mockHanaClient = {
      executeQuery: async () => ({
        rows: [
          {
            TABLE_NAME: 'SALES_FACT_HUGE',
            RECORD_COUNT: 7500000,
            MEMORY_MB: 2800,
            IS_PARTITIONED: 'FALSE',
          },
          {
            TABLE_NAME: 'ITEMS_NO_PK',
            RECORD_COUNT: 250000,
            MEMORY_MB: 120,
            IS_PARTITIONED: 'FALSE',
          },
        ],
      }),
    };

    const report = await SpaceAuditor.auditPerformanceOptimizations({
      spaceId: 'FTDWH_100_INT',
      thresholdRows: 100000,
      hanaClient: mockHanaClient,
    });

    expect(report).toBeDefined();
    expect(report.spaceId).toBe('FTDWH_100_INT');
    expect(report.summary.totalAssetsAudited).toBeGreaterThan(0);
    expect(report.summary.criticalBottlenecks).toBeGreaterThan(0);

    // Table Volume Insight: Check for unpartitioned SALES_FACT_HUGE (>5M rows)
    const fact = report.tables.find(t => t.tableName === 'SALES_FACT_HUGE');
    expect(fact).toBeDefined();
    expect(fact?.optimizationPriority).toBe('HIGH');
    expect(fact?.rowCountEstimate).toBe(7500000);
    expect(fact?.actionSqlOrCsn).toContain('PARTITION BY RANGE');
    expect(fact?.insights[0]).toContain('Full table scans on unpartitioned');
  });
});
