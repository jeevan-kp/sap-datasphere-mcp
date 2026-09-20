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

  it('audits performance optimizations and flags unpartitioned tables, unpersisted views, and full-load pipelines', async () => {
    const report = await SpaceAuditor.auditPerformanceOptimizations({
      spaceId: 'FTDWH_100_INT',
      thresholdRows: 100000,
    });

    expect(report).toBeDefined();
    expect(report.spaceId).toBe('FTDWH_100_INT');
    expect(report.summary.totalAssetsAudited).toBeGreaterThan(0);
    expect(report.summary.criticalBottlenecks).toBeGreaterThan(0);
    expect(report.summary.estimatedMemorySavingsMb).toBeGreaterThan(0);
    expect(report.summary.overallOptimizationScore).toBeLessThan(100);

    // 1. Table Volume Insight: Check for unpartitioned ACDOCA (>5M rows)
    const acdoca = report.tables.find(t => t.tableName.includes('ACDOCA'));
    expect(acdoca).toBeDefined();
    expect(acdoca?.optimizationPriority).toBe('HIGH');
    expect(acdoca?.rowCountEstimate).toBeGreaterThanOrEqual(5000000);
    expect(acdoca?.actionSqlOrCsn).toContain('PARTITION BY RANGE');
    expect(acdoca?.insights[0]).toContain('Full table scans on unpartitioned');

    // 2. View Persistency Insight: Check for multi-million row unpersisted view
    const view = report.views.find(v => v.viewName === 'V_FIN_REVENUE_CUBE');
    expect(view).toBeDefined();
    expect(view?.optimizationPriority).toBe('HIGH');
    expect(view?.underlyingVolumeEstimate).toBeGreaterThan(10000000);
    expect(view?.actionSqlOrCsn).toContain('@Datasphere.persistency');

    // 3. Pipeline Inefficiency Insight: Check for recurring full load on heavy dataset
    const pipeline = report.pipelines.find(p => p.pipelineName === 'TC_DAILY_ERP_REPLICATION');
    expect(pipeline).toBeDefined();
    expect(pipeline?.optimizationPriority).toBe('HIGH');
    expect(pipeline?.replicationMode).toBe('FULL_LOAD');
    expect(pipeline?.recommendations[0]).toContain('INITIAL_AND_DELTA');

    // 4. Recommendation Summary
    expect(report.recommendationSummary.length).toBeGreaterThanOrEqual(3);
  });
});
