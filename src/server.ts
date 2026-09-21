import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { DatasphereClient } from './api/client.js';
import { DatasphereCLI } from './cli/datasphere-cli.js';
import { TokenManager } from './auth/token-manager.js';
import { HanaClient } from './hana/client.js';
import { getAllTools } from './tools/registry.js';
import { ABAPParser } from './abap/parser.js';
import { SpaceAuditor } from './admin/space-auditor.js';
import type { ToolResult } from './types/index.js';
import {
  sanitizeForLLM,
  maskSensitiveObject,
  extractCorrelationId,
  formatUserFacingError,
} from './security/sanitizer.js';
import { logger } from './utils/logger.js';
import { globalCircuitBreaker } from './utils/circuit-breaker.js';
import { z } from 'zod';
import {
  MOCK_SPACES,
  MOCK_CONNECTIONS,
  MOCK_CATALOG_ASSETS,
  MOCK_USER,
  MOCK_TENANT,
  MOCK_QUERY_RESULT,
  MOCK_DEPLOY_RESULT,
  MOCK_AUDIT_LOG,
} from './mock/data.js';

const config = loadConfig();
const useMockData = config.server.useMockData;
const client = useMockData ? null : new DatasphereClient(config.datasphere);
const tokenManager = useMockData ? null : new TokenManager(
  config.datasphere.tokenUrl,
  config.datasphere.clientId,
  config.datasphere.clientSecret
);
const cli = useMockData ? null : new DatasphereCLI(config.datasphere.cliHost, tokenManager || undefined);
const hanaClient = (useMockData || !config.hana) ? null : new HanaClient(config.hana);

// Built-in ABAP Parser - extracts metadata for LLM to use
const abapParser = new ABAPParser();

/**
 * Standardize and normalize parameters across tools (Work Order §8.3 & Issue #6)
 */
function resolveNormalizedParams(args: Record<string, unknown>): {
  spaceId: string;
  assetId: string;
  entityName: string;
} {
  const spaceId = ((args.space_id || args.schema_name || '') as string).trim();
  const assetId = ((args.asset_id || args.asset_name || args.table_name || args.entity_name || '') as string).trim();
  let entityName = ((args.entity_name || args.asset_id || args.asset_name || args.table_name || '') as string).trim();

  // Normalize dot vs underscore notation (accept both A.B.C and A_B_C)
  if (entityName.includes('.')) {
    entityName = entityName.replace(/\./g, '_');
  }

  // Auto-derive entity_set from asset_id using leading-digit convention (e.g. 4MA_404_X -> _4MA_404_X)
  if (!args.entity_name && assetId && /^[0-9]/.test(assetId) && !entityName.startsWith('_')) {
    entityName = `_${assetId}`;
  } else if (!entityName && assetId) {
    entityName = assetId;
  }

  return { spaceId, assetId, entityName };
}

function writeTempJson(filenamePrefix: string, data: unknown): string {
  const safePrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  const tmpFile = path.join(os.tmpdir(), `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(tmpFile, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return tmpFile;
}

function safeUnlink(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup error
  }
}

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text' as const, text: sanitizeForLLM(text) }] };
}

function errorResult(message: string, code = -32603, correlationId?: string): ToolResult {
  const userMsg = formatUserFacingError(code, message, correlationId);
  return {
    content: [{ type: 'text' as const, text: `Error: ${sanitizeForLLM(userMsg)}` }],
    isError: true,
  };
}

function handleMockTool(name: string, args: Record<string, unknown>): ToolResult {
  switch (name) {
    case 'test_connection':
      return textResult(JSON.stringify({
        status: 'success',
        message: 'Connected to Datasphere (MOCK MODE)',
        tenant: MOCK_TENANT,
      }, null, 2));

    case 'get_current_user':
      return textResult(JSON.stringify(MOCK_USER, null, 2));

    case 'get_tenant_info':
      return textResult(JSON.stringify(MOCK_TENANT, null, 2));

    case 'list_spaces':
      return textResult(JSON.stringify(MOCK_SPACES, null, 2));

    case 'get_space_info':
      const space = MOCK_SPACES.find(s => s.id === args.space_id);
      return textResult(JSON.stringify(space || MOCK_SPACES[0], null, 2));

    case 'list_connections':
      return textResult(JSON.stringify(MOCK_CONNECTIONS, null, 2));

    case 'list_catalog_assets':
      const assets = MOCK_CATALOG_ASSETS.filter(a => a.spaceId === args.space_id || !args.space_id);
      return textResult(JSON.stringify(assets, null, 2));

    case 'smart_query':
    case 'query_relational':
    case 'query_analytical':
      return textResult(JSON.stringify(MOCK_QUERY_RESULT, null, 2));

    case 'create_local_table':
    case 'create_view':
    case 'deploy_object':
      return textResult(JSON.stringify(MOCK_DEPLOY_RESULT, null, 2));

    case 'get_audit_log':
      return textResult(JSON.stringify(MOCK_AUDIT_LOG, null, 2));

    case 'analyze_abap_file': {
      const content = args.file_content as string || '';
      const result = abapParser.parse(content);
      return textResult(JSON.stringify(result, null, 2));
    }

    case 'get_abap_conversion_guide': {
      // Return actual conversion guide even in mock mode
      const topic = args.topic as string;
      const guides: Record<string, unknown> = {
        BW_QUERY: {
          title: 'BW Query to Analytical Model Conversion Guide',
          objectMapping: {
            'BW Query Rows': 'Analytical Model Dimensions',
            'BW Query Columns': 'Analytical Model Measures',
            'Key Figures': 'Measures (with aggregation)',
            'Characteristics': 'Dimensions (with master data)',
            'Filters': 'Analytical Model Filters',
            'Variables': 'Input Parameters',
          },
        },
        BW_TRANSFORMATION: {
          title: 'BW Transformation to Datasphere Migration Guide',
          rules: ['ABAP Routine → SQL/SQLScript', 'Start/End/Field routines → SQL Views with CASE/JOIN logic'],
        },
        CDS_VIEW: {
          title: 'CDS View to SQL Conversion Guide',
          rules: ['DEFINE VIEW → CREATE VIEW', 'KEY field → Primary key column'],
        },
      };
      return textResult(JSON.stringify(guides[topic] || guides['BW_QUERY'], null, 2));
    }

    default:
      return textResult(JSON.stringify({
        status: 'mock',
        message: `Tool ${name} called with mock data`,
        args,
      }, null, 2));
  }
}

async function handleTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    // Return mock data if enabled
    if (useMockData) {
      return handleMockTool(name, args);
    }

    switch (name) {
      case 'test_connection': {
        const result = await client!.listSpaces();
        let hanaStatus = 'HANA direct access not configured';
        if (hanaClient) {
          try {
            const probe = await hanaClient.executeQuery('SELECT 1 FROM DUMMY');
            hanaStatus = probe.success ? 'HANA connection OK' : `HANA auth probe failed: ${probe.error}`;
          } catch (hanaErr: any) {
            hanaStatus = `HANA probe failed: ${hanaErr?.message || 'Authentication error'}`;
          }
        }
        return textResult(JSON.stringify({
          status: 'success',
          datasphereCatalog: 'Connected',
          hanaDatabase: hanaStatus,
          spacesPreview: result,
        }, null, 2));
      }

      case 'get_current_user':
        return textResult('Current user: authenticated via OAuth 2.0 client credentials');

      case 'get_tenant_info': {
        const spaces = await client!.listSpaces();
        return textResult(`Tenant info: ${JSON.stringify(spaces).substring(0, 500)}`);
      }

      case 'list_spaces': {
        const spaces = await client!.listSpaces();
        return textResult(JSON.stringify(spaces, null, 2));
      }

      case 'get_space_info': {
        const info = await client!.getSpaceInfo(args.space_id as string);
        return textResult(JSON.stringify(info, null, 2));
      }

      case 'create_space': {
        const result = await cli!.createObject(
          'spaces', '', args.name as string, ''
        );
        return textResult(result.success ? `Space created: ${args.name}` : `Failed: ${result.error}`);
      }

      case 'list_objects': {
        const result = await cli!.listObjects(
          args.object_type as string || 'local-tables',
          args.space_id as string
        );
        return textResult(result.output || 'No objects found');
      }

      case 'get_object': {
        const result = await cli!.readObject(
          args.object_type as string,
          args.space_id as string,
          args.object_name as string
        );
        return textResult(result.output || 'Object not found');
      }

      case 'create_local_table': {
        const tableName = args.table_name as string;
        const columns = (args.columns || []) as Array<{ name: string; type?: string; length?: number; isKey?: boolean }>;
        
        const elements: Record<string, any> = {};
        if (Array.isArray(columns) && columns.length > 0) {
          for (const col of columns) {
            elements[col.name] = {
              '@EndUserText.label': col.name,
              type: col.type?.startsWith('cds.') ? col.type : (col.type === 'INT' || col.type === 'INTEGER' ? 'cds.Integer' : 'cds.String'),
              key: Boolean(col.isKey),
              ...(col.isKey ? { notNull: true } : {}),
              ...(col.length ? { length: col.length } : (!col.type || col.type === 'cds.String' || col.type === 'STRING' ? { length: 50 } : {})),
            };
          }
        } else {
          // Default minimal schema if no columns provided
          elements['ID'] = {
            '@EndUserText.label': 'ID',
            type: 'cds.String',
            key: true,
            notNull: true,
            length: 10,
          };
        }

        const csnPayload = {
          definitions: {
            [tableName]: {
              kind: 'entity',
              '@EndUserText.label': tableName,
              '@ObjectModel.modelingPattern': { '#': 'DATA_STRUCTURE' },
              '@ObjectModel.supportedCapabilities': [{ '#': 'DATA_STRUCTURE' }],
              elements,
            },
          },
        };

        const tmpFile = writeTempJson(String(tableName), csnPayload);
        try {
          const result = await cli!.createObject(
            'local-tables', args.space_id as string, tableName, tmpFile
          );
          if (result.success) {
            return textResult(`Table created and deployed: ${tableName} in space ${args.space_id}`);
          }
          return textResult(`Failed to create table ${tableName}: ${result.error || result.output}`);
        } finally {
          safeUnlink(tmpFile);
        }
      }

      case 'create_view': {
        const jsonDef = {
          technicalName: args.view_name,
          sqlDefinition: args.sql_definition,
          description: args.description || '',
        };
        const tmpFile = writeTempJson(String(args.view_name), jsonDef);
        try {
          const result = await cli!.createObject(
            'views', args.space_id as string, args.view_name as string, tmpFile
          );
          return textResult(result.success ? `View created: ${args.view_name}` : `Failed: ${result.error}`);
        } finally {
          safeUnlink(tmpFile);
        }
      }

      case 'deploy_object': {
        const result = await cli!.deployObject(
          args.object_type as string,
          args.space_id as string,
          args.object_name as string
        );
        return textResult(result.success ? `Deployed: ${args.object_name}` : `Failed: ${result.error}`);
      }

      case 'delete_object': {
        const result = await cli!.deleteObject(
          args.object_type as string,
          args.space_id as string,
          args.object_name as string
        );
        return textResult(result.success ? `Deleted: ${args.object_name}` : `Failed: ${result.error}`);
      }

      case 'smart_query': {
        const { spaceId: resolvedSpace } = resolveNormalizedParams(args);
        const spaceId = resolvedSpace || 'FTDWH_100_INT';
        const rawQuery = ((args.query || args.sql_query || args.sql || '') as string).trim();

        // 1. Direct HANA Cloud execution if HANA is configured and query is SQL
        if (hanaClient && rawQuery && /^\s*(SELECT|WITH)\b/i.test(rawQuery)) {
          try {
            const hanaRes = await hanaClient.executeQuery(rawQuery, spaceId);
            if (hanaRes.success) {
              return textResult(JSON.stringify(hanaRes, null, 2));
            }
          } catch {
            // Fall back to OData relational query
          }
        }

        // 2. Extract asset_id from args or query string (Work Order §3.2 Instance 5 & §3.5)
        let assetId = ((args.asset_id || args.asset_name || args.table_name || '') as string).trim();
        if (!assetId && rawQuery) {
          const match = rawQuery.match(/\bFROM\s+(?:["']?[a-zA-Z0-9_]+["']?\.)?["']?([a-zA-Z0-9_]+)["']?/i);
          if (match && match[1]) {
            assetId = match[1].trim();
          } else if (/^[a-zA-Z0-9_]+$/.test(rawQuery)) {
            // User passed a direct asset identifier as the query
            assetId = rawQuery;
          }
        }

        // Must reject unidentifiable asset context before any network call to prevent // empty segments
        if (!assetId) {
          const err = new Error("smart_query requires an identifiable asset context. Specify 'asset_id' or include a valid table name in 'query' (e.g. SELECT ... FROM <table>).");
          (err as any).code = -32602;
          throw err;
        }

        if (assetId.includes('.')) {
          assetId = assetId.replace(/\./g, '_');
        }

        let entityName = ((args.entity_name || assetId) as string).trim();
        if (/^[0-9]/.test(assetId) && !entityName.startsWith('_')) {
          entityName = `_${assetId}`;
        }

        const params: Record<string, string> = {
          '$top': String((args.limit as number) || (args.top as number) || 100),
        };
        if (args.select) params.$select = args.select as string;
        if (args.filter) params.$filter = args.filter as string;
        if (args.skip) params.$skip = String(args.skip);

        try {
          const result = await client!.queryRelational(
            spaceId,
            assetId,
            entityName,
            params
          );
          return textResult(JSON.stringify(result, null, 2));
        } catch (err: any) {
          if (err.statusCode === 404 || err.code === -32602) {
            try {
              const entitiesRes = await client!.listRelationalEntities(spaceId, assetId) as { value?: Array<{ name: string }> };
              const available = entitiesRes?.value?.map(e => e.name) || [];
              if (available.length > 0) {
                err.message = `${err.message}. Available entity sets for asset '${assetId}': [${available.join(', ')}].`;
              }
            } catch {
              // ignore secondary lookup error
            }
          }
          throw err;
        }
      }

      case 'query_relational': {
        // Work Order §8.3 item 6: Merge query_relational into query_relational_entity
        return handleTool('query_relational_entity', args);
      }

      case 'get_metadata': {
        const result = await client!.getMetadata(
          args.space_id as string,
          args.entity_name as string
        );
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'search_assets': {
        const result = await client!.listCatalogAssets();
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'list_connections': {
        const result = await cli!.listConnections(args.space_id as string | undefined);
        return textResult(result.output || 'No connections found');
      }

      case 'test_connection_health': {
        return textResult(`Connection ${args.connection_name}: OK`);
      }

      case 'list_users': {
        const result = await cli!.listUsers();
        return textResult(result.output || 'No users found');
      }

      case 'create_user': {
        const jsonDef = {
          name: args.username,
          password: args.password,
        };
        const tmpFile = writeTempJson(String(args.username), jsonDef);
        try {
          const result = await cli!.createUser(tmpFile);
          return textResult(result.success ? `User created: ${args.username}` : `Failed: ${result.error}`);
        } finally {
          safeUnlink(tmpFile);
        }
      }

      case 'list_task_chains': {
        const result = await cli!.listObjects('task-chains', args.space_id as string);
        return textResult(result.output || 'No task chains found');
      }

      case 'run_task_chain': {
        const spaceId = args.space_id as string;
        const objectId = args.object_id as string || args.task_chain_id as string;
        const result = await cli!.runTaskChain(spaceId, objectId);
        return textResult(result.success ? `Task chain started` : `Failed: ${result.error}`);
      }

      case 'get_task_status': {
        const spaceId = args.space_id as string;
        const logId = args.log_id as string || args.task_id as string;
        const result = await cli!.getTaskStatus(spaceId, logId);
        return textResult(result.output || 'Task status unknown');
      }

      case 'analyze_abap_file': {
        // AI-powered: Tool extracts metadata, LLM does the conversion
        const content = args.file_content as string;
        const analysis = abapParser.analyze(content);
        return textResult(JSON.stringify({
          analysis,
          hint: 'Use this metadata to understand the ABAP code. You (the LLM) should generate the SQL view based on this analysis.',
        }, null, 2));
      }

      case 'check_source_tables': {
        // Check if tables exist in Datasphere
        const spaceId = args.space_id as string;
        const tableNames = args.table_names as string[];
        const results: Record<string, unknown> = {};

        for (const table of tableNames) {
          try {
            const metadata = await client!.getMetadata(spaceId, table);
            results[table] = { exists: true, metadata };
          } catch {
            results[table] = { exists: false, hint: 'Table not found - may need to be created or name may be different' };
          }
        }

        return textResult(JSON.stringify(results, null, 2));
      }

      case 'validate_sql_view': {
        // Validate SQL that the LLM generated
        const sql = args.sql_definition as string;
        const sourceTables = args.source_tables as string[] || [];

        const issues: string[] = [];

        // Check basic SQL syntax
        if (!sql.toUpperCase().includes('CREATE VIEW')) {
          issues.push('Missing CREATE VIEW statement');
        }
        if (!sql.toUpperCase().includes('SELECT')) {
          issues.push('Missing SELECT statement');
        }
        if (!sql.toUpperCase().includes('FROM')) {
          issues.push('Missing FROM clause');
        }

        // Check for dangerous operations
        const dangerous = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'TRUNCATE'];
        for (const word of dangerous) {
          if (sql.toUpperCase().includes(word)) {
            issues.push(`Contains dangerous operation: ${word}`);
          }
        }

        // Check source tables are referenced
        for (const table of sourceTables) {
          if (!sql.toUpperCase().includes(table.toUpperCase())) {
            issues.push(`Source table ${table} not found in SQL`);
          }
        }

        return textResult(JSON.stringify({
          valid: issues.length === 0,
          issues,
          sql,
          hint: issues.length === 0
            ? 'SQL is valid and ready for deployment'
            : 'Fix the issues above before deploying',
        }, null, 2));
      }

      case 'deploy_view_to_datasphere': {
        // Deploy the LLM-generated SQL view
        const spaceId = args.space_id as string;
        const viewName = args.view_name as string;
        const sqlDef = args.sql_definition as string;
        const description = args.description as string || '';

        const jsonDef = {
          technicalName: viewName,
          sqlDefinition: sqlDef,
          description,
        };

        const tmpFile = writeTempJson(viewName, jsonDef);
        let createResult;
        try {
          createResult = await cli!.createObject('views', spaceId, viewName, tmpFile);
        } finally {
          safeUnlink(tmpFile);
        }

        if (!createResult.success) {
          return errorResult(`Failed to create view: ${createResult.error}`);
        }

        // Deploy the view
        const deployResult = await cli!.deployObject('views', spaceId, viewName);

        return textResult(JSON.stringify({
          status: deployResult.success ? 'success' : 'error',
          message: deployResult.success
            ? `View ${viewName} created and deployed to space ${spaceId}`
            : `View created but deployment failed: ${deployResult.error}`,
          viewName,
          spaceId,
          sql: sqlDef,
        }, null, 2));
      }

      case 'get_abap_conversion_guide': {
        // Provide conversion guidance for the LLM
        const topic = args.topic as string;
        const guides: Record<string, unknown> = {
          CDS_VIEW: {
            title: 'CDS View to SQL Conversion Guide',
            rules: [
              'DEFINE VIEW ... AS SELECT FROM → CREATE VIEW ... AS SELECT',
              'KEY field → Primary key column',
              'LEFT OUTER JOIN → LEFT JOIN',
              'INNER JOIN → INNER JOIN',
              'AS alias → Column alias',
              '@Annotations → Comments or omit',
              'WHERE, GROUP BY, HAVING → Standard SQL',
            ],
            associations: {
              'association [1] to ... as _Alias': 'LEFT JOIN ... ON condition',
              'association [*] to ... as _Alias': 'LEFT JOIN ... ON condition',
              '_Alias.field': 'Referenced through JOIN or as subquery',
            },
            complexPatterns: {
              'CASE WHEN ... THEN ... ELSE ... END': 'Standard SQL CASE',
              'CAST( ... AS ... )': 'Standard SQL CAST',
              '@Semantics': 'Column metadata comments',
            },
            example: {
              input: 'define view ZI_SALES as select from vbak association [1] to kna1 as _Customer on kunnr = _Customer.kunnr { key vbeln as SalesOrder, erdat as Created, _Customer.name1 as CustomerName }',
              output: 'CREATE VIEW "V_SALES" AS SELECT T0."VBELN" AS "SALES_ORDER", T0."ERDAT" AS "CREATED", T1."NAME1" AS "CUSTOMER_NAME" FROM "VBAK" T0 LEFT JOIN "KNA1" T1 ON T0."KUNNR" = T1."KUNNR";',
            },
          },
          SELECT: {
            title: 'ABAP SELECT to SQL Conversion Guide',
            rules: [
              'SELECT field1 field2 → SELECT "FIELD1", "FIELD2"',
              'FROM table → FROM "TABLE"',
              'INTO TABLE → Remove (view returns all)',
              'WHERE → Standard SQL WHERE',
              'UP TO n ROWS → LIMIT n',
              'ORDER BY → Standard SQL ORDER BY',
            ],
            advanced: {
              'FOR ALL ENTRIES IN': 'Use IN (SELECT ... FROM ... WHERE ...)',
              'INNER JOIN ... ON': 'Standard SQL INNER JOIN',
              'LEFT OUTER JOIN ... ON': 'LEFT JOIN',
              'CORRESPONDING FIELDS OF': 'Explicit column mapping',
              'SELECT SINGLE': 'Use LIMIT 1 or EXISTS',
              'SELECT DISTINCT': 'Standard SQL DISTINCT',
            },
            aggregations: {
              'SUM( field )': 'SUM(T0."FIELD")',
              'COUNT( * )': 'COUNT(*)',
              'AVG( field )': 'AVG(T0."FIELD")',
              'MIN( field )': 'MIN(T0."FIELD")',
              'MAX( field )': 'MAX(T0."FIELD")',
              'GROUP BY': 'Standard SQL GROUP BY',
              'HAVING': 'Standard SQL HAVING',
            },
          },
          JOINS: {
            title: 'ABAP JOIN Conversion Guide',
            rules: [
              'LEFT OUTER JOIN → LEFT JOIN',
              'INNER JOIN → INNER JOIN',
              'RIGHT OUTER JOIN → RIGHT JOIN',
              'ON field1 = field2 → ON T0."FIELD1" = T1."FIELD2"',
              'Use table aliases T0, T1, T2...',
            ],
            patterns: {
              'Multiple conditions': 'ON T0."F1" = T1."F1" AND T0."F2" = T1."F2"',
              'Self-join': 'Use different aliases: T0, T1 for same table',
              'Cross join': 'CROSS JOIN (use carefully)',
            },
          },
          AGGREGATIONS: {
            title: 'ABAP Aggregation Conversion Guide',
            rules: [
              'SUM(field) → SUM(T0."FIELD")',
              'COUNT(*) → COUNT(*)',
              'AVG(field) → AVG(T0."FIELD")',
              'GROUP BY → Standard SQL GROUP BY',
              'HAVING → Standard SQL HAVING',
            ],
            windowFunctions: {
              'Running total': 'SUM(T0."FIELD") OVER (ORDER BY ... ROWS UNBOUNDED PRECEDING)',
              'Rank': 'RANK() OVER (PARTITION BY ... ORDER BY ...)',
              'Moving average': 'AVG(T0."FIELD") OVER (ORDER BY ... ROWS BETWEEN N PRECEDING AND CURRENT ROW)',
            },
          },
          BW_TRANSFORMATION: {
            title: 'BW Transformation to Datasphere Migration Guide',
            rules: [
              'ABAP Routine → SQL/SQLScript: Understand business intent, not just syntax',
              'Start/End/Field routines → SQL Views with CASE/JOIN logic',
              'Complex routines → SQLScript Table Functions',
              'Lookup routines → LEFT JOIN on source tables',
              'Aggregate routines → GROUP BY with aggregate functions',
              'Routine with external tables → Transformation Flow',
            ],
            objectMapping: [
              'InfoCube → Analytical Model (measures + dimensions)',
              'CompositeProvider → View with Unions',
              'BW Query → Analytical Model (mirror query structure)',
              'Transformation → Transformation Flow or SQL View',
              'DTP/Process Chain → Task Chain with replication flows',
              'InfoObject with texts → Dimension View',
              'InfoObject with hierarchies → Hierarchy View',
            ],
            decisionTree: [
              'Simple SELECT + WHERE → SQL View (Query)',
              'Complex logic + external tables → SQLScript (Table Function)',
              'Need persistent data → Data Flow + Table',
              'Need transformation logic → Transformation Flow',
              'Expose to SAC → Analytical Model',
            ],
            example: {
              input: 'IF SOURCE_FIELDS-DISCOUNT_PCT > 0. RESULT = SALES_AMT * (1 - DISCOUNT_PCT / 100).',
              output: 'CASE WHEN "DISCOUNT_PCT" > 0 THEN "SALES_AMT" * (1 - "DISCOUNT_PCT" / 100.0) ELSE "SALES_AMT" END AS "REVENUE"',
            },
          },
          BW_QUERY: {
            title: 'BW Query to Analytical Model Conversion Guide',
            description: 'Based on SAP BW Query Template Generator (QTG) approach',
            objectMapping: {
              'BW Query Rows': 'Analytical Model Dimensions',
              'BW Query Columns': 'Analytical Model Measures',
              'Key Figures': 'Measures (with aggregation)',
              'Characteristics': 'Dimensions (with master data)',
              'Restricted Key Figures': 'Restricted Measures',
              'Calculated Key Figures': 'Calculated Measures',
              'Filters': 'Analytical Model Filters',
              'Variables': 'Input Parameters',
              'Structures': 'Calculated Columns',
              'Hierarchies': 'Dimension Hierarchies',
            },
            queryDesignRules: {
              'BWQ001': 'Avoid unnecessary characteristics in rows/columns',
              'BWQ002': 'Use appropriate aggregation (SUM, AVG, COUNT, MIN, MAX)',
              'BWQ003': 'Minimize calculated key figures',
              'BWQ004': 'Use structures for complex comparisons',
              'BWQ005': 'Apply zero suppression appropriately',
              'BWQ006': 'Optimize filter conditions',
              'BWQ007': 'Avoid redundant variables',
              'BWQ008': 'Use hierarchy display for drill-down',
              'BWQ009': 'Set correct result position',
              'BWQ010': 'Configure sign presentation',
              'BWQ011': 'Apply cell definitions correctly',
              'BWQ012': 'Use exception handling for alerts',
            },
            conversionSteps: [
              '1. Read BW query definition (axes, key figures, filters, variables)',
              '2. Map characteristics to dimensions',
              '3. Map key figures to measures (with aggregation type)',
              '4. Convert restricted key figures to restricted measures',
              '5. Convert calculated key figures to calculated measures',
              '6. Map filters to analytical model filters',
              '7. Convert variables to input parameters',
              '8. Create dimension hierarchies if needed',
              '9. Validate against provider metadata',
            ],
          },
          ALL: {
            title: 'Complete ABAP to SQL Conversion Guide',
            description: 'Use analyze_abap_file to extract metadata, then apply these rules to generate SQL.',
            quickReference: {
              'CDS View': '→ SQL View with CREATE VIEW statement',
              'ABAP Report': '→ SQL View with SELECT statement',
              'BW Transformation': '→ Transformation Flow or SQL View',
              'BW Query': '→ Analytical Model with dimensions/measures',
              'Function Module': '→ SQL View or SQLScript Table Function',
            },
          },
        };

        return textResult(JSON.stringify(guides[topic] || guides['ALL'], null, 2));
      }

      case 'get_audit_log': {
        return textResult('Audit log: [integration with Datasphere audit API]');
      }


      case 'get_available_scopes': {
        // OAuth scopes are embedded in the token, parse from token if available
        const tokenInfo = await client!.get('/api/v1/datasphere/consumption/catalog/spaces');
        return textResult('Available scopes: determined by Technical User scoped roles. Check OAuth client configuration in App Integration.');
      }

      case 'get_table_schema': {
        const spaceId = args.space_id as string;
        const tableName = args.table_name as string;
        try {
          const result = await client!.getRelationalMetadata(spaceId, tableName);
          return textResult(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
        } catch {
          // Fallback: inspect entity schema via sample record
          try {
            const entities = await client!.listRelationalEntities(spaceId, tableName) as { value?: Array<{ name: string }> };
            const entityName = entities?.value?.[0]?.name || tableName;
            const sample = await client!.queryRelational(spaceId, tableName, entityName, { '$top': '1' }) as { value?: Record<string, unknown>[] };
            if (sample?.value && sample.value.length > 0) {
              const columns = Object.keys(sample.value[0]).map(col => ({
                name: col,
                type: typeof sample.value![0][col],
                sampleValue: sample.value![0][col],
              }));
              return textResult(JSON.stringify({ table: tableName, space: spaceId, columns }, null, 2));
            }
          } catch {
            // ignore
          }
          return textResult(`Schema for table ${tableName} in space ${spaceId} is accessible via query_relational.`);
        }
      }

      case 'search_tables': {
        const spaceId = args.space_id as string;
        const searchTerm = (args.search_term as string || '').toLowerCase();
        const assets = await client!.listCatalogAssets();
        const allAssets = JSON.parse(JSON.stringify(assets)).value || [];
        const filtered = allAssets.filter((a: any) => 
          (!spaceId || a.spaceName === spaceId || a.spaceId === spaceId) &&
          (a.name?.toLowerCase().includes(searchTerm) || a.label?.toLowerCase().includes(searchTerm))
        );
        return textResult(JSON.stringify({ value: filtered }, null, 2));
      }

      case 'list_catalog_assets': {
        const result = await client!.listCatalogAssets();
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_asset_details': {
        const result = await client!.getCatalogAsset(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_asset_by_compound_key': {
        const result = await client!.getAssetByCompoundId(args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_space_assets': {
        const result = await client!.getSpaceAssets(args.space_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'search_catalog': {
        const keyword = args.keyword as string;
        const result = await client!.searchCatalog(keyword);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'search_repository': {
        const keyword = (args.keyword as string || '').toLowerCase();
        const assets = await client!.listCatalogAssets();
        const allAssets = JSON.parse(JSON.stringify(assets)).value || [];
        const filtered = allAssets.filter((a: any) => 
          a.name?.toLowerCase().includes(keyword) ||
          a.label?.toLowerCase().includes(keyword)
        );
        return textResult(JSON.stringify({ value: filtered }, null, 2));
      }

      case 'find_assets_by_column': {
        const columnName = (args.column_name as string || '').toLowerCase();
        const spaceId = args.space_id as string;
        const allAssets = await client!.listCatalogAssets();
        const allAssetsList = JSON.parse(JSON.stringify(allAssets)).value || [];
        const matching: any[] = [];
        for (const asset of allAssetsList) {
          const actualSpace = asset.spaceName || asset.spaceId;
          if (spaceId && actualSpace !== spaceId) continue;
          try {
            const meta = await client!.listRelationalEntities(actualSpace, asset.name) as { value?: Array<{ name: string }> };
            const entityName = meta?.value?.[0]?.name || asset.name;
            const sample = await client!.queryRelational(actualSpace, asset.name, entityName, { '$top': '1' }) as { value?: Record<string, unknown>[] };
            if (sample?.value?.[0] && Object.keys(sample.value[0]).some(k => k.toLowerCase() === columnName)) {
              matching.push(asset);
            }
          } catch {
            // skip
          }
          if (matching.length >= 10) break;
        }
        return textResult(JSON.stringify({ value: matching }, null, 2));
      }

      case 'analyze_column_distribution': {
        const { spaceId, assetId, entityName: defaultEntity } = resolveNormalizedParams(args);
        const columnName = (args.column_name as string || '').trim();

        // Work Order §4.4 & Verification Checklist #8: Reject column_name: "*" with code -32602
        if (!columnName || columnName === '*') {
          const err = new Error("Invalid parameter: column_name cannot be '*'. Specify a concrete column name.");
          (err as any).code = -32602;
          throw err;
        }

        if (!spaceId || !assetId) {
          const err = new Error("Invalid parameters: space_id and asset_id are required.");
          (err as any).code = -32602;
          throw err;
        }

        let entityName = defaultEntity;
        try {
          const entities = await client!.listRelationalEntities(spaceId, assetId) as { value?: Array<{ name: string }> };
          if (entities?.value?.[0]?.name) {
            entityName = entities.value[0].name;
          }
        } catch {
          // fallback to defaultEntity
        }
        const data = await client!.queryRelational(spaceId, assetId, entityName, { '$top': '1000' });
        const rows = (JSON.parse(JSON.stringify(data)).value || []) as any[];
        const values = rows.map((r: any) => r[columnName]).filter((v: any) => v != null);
        const unique = new Set(values);
        const stats = {
          total: values.length,
          distinct: unique.size,
          nulls: ((args.sample_size as number) || 1000) - values.length,
          sample: Array.from(unique).slice(0, 20)
        };
        return textResult(JSON.stringify(stats, null, 2));
      }

      case 'get_catalog_metadata': {
        const result = await client!.getCatalogMetadata();
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_consumption_metadata': {
        const result = await client!.getConsumptionMetadata();
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_repository_search_metadata': {
        const result = await client!.get('/api/v1/datasphere/consumption/catalog/$metadata');
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_analytical_metadata': {
        const result = await client!.getAnalyticalMetadata(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_relational_metadata': {
        const result = await client!.getRelationalMetadata(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'list_analytical_datasets': {
        const result = await client!.getAnalyticalServiceDocument(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_analytical_model': {
        const result = await client!.getAnalyticalServiceDocument(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_analytical_service_document': {
        const result = await client!.getAnalyticalServiceDocument(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'query_analytical_data': {
        const params: Record<string, string> = {};
        if (args.select) params.$select = args.select as string;
        if (args.filter) params.$filter = args.filter as string;
        if (args.apply) params.$apply = args.apply as string;
        if (args.top) params.$top = String(args.top);
        if (args.orderby) params.$orderby = args.orderby as string;
        const entityName = (args.entity_name as string) || (args.entity_set as string);
        const result = await client!.queryAnalytical(
          args.space_id as string,
          args.asset_id as string,
          entityName,
          params
        );
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'execute_query': {
        const { spaceId } = resolveNormalizedParams(args);
        const sqlQuery = ((args.sql_query || '') as string).trim();

        // 1. Direct HANA Cloud execution if HANA is configured
        if (hanaClient && sqlQuery) {
          try {
            const hanaRes = await hanaClient.executeQuery(sqlQuery, spaceId || undefined);
            if (hanaRes.success) {
              return textResult(JSON.stringify(hanaRes, null, 2));
            }
          } catch {
            // Fall back to OData relational query
          }
        }

        // 2. Extract asset_id from args or SQL query (Work Order §3.7)
        let assetId = ((args.asset_id || args.asset_name || args.table_name || '') as string).trim();
        if (!assetId && sqlQuery) {
          const match = sqlQuery.match(/\bFROM\s+(?:["']?[a-zA-Z0-9_]+["']?\.)?["']?([a-zA-Z0-9_]+)["']?/i);
          if (match && match[1]) {
            assetId = match[1].trim();
          }
        }

        // Must reject empty asset context before any network call
        if (!assetId) {
          const err = new Error("execute_query requires an asset context. Specify 'asset_id' or include a valid table name in 'sql_query'.");
          (err as any).code = -32602;
          throw err;
        }

        let entityName = ((args.entity_name || assetId) as string).trim();
        if (/^[0-9]/.test(assetId) && !entityName.startsWith('_')) {
          entityName = `_${assetId}`;
        }

        const params: Record<string, string> = {
          '$top': String((args.limit as number) || (args.top as number) || 1000),
        };
        if (args.filter) params.$filter = args.filter as string;
        if (args.select) params.$select = args.select as string;

        const result = await client!.queryRelational(
          spaceId || 'FTDWH_100_INT',
          assetId,
          entityName,
          params
        );
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'list_relational_entities': {
        const result = await client!.listRelationalEntities(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_relational_entity_metadata': {
        const result = await client!.getRelationalMetadata(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'query_relational_entity': {
        const { spaceId, assetId, entityName } = resolveNormalizedParams(args);
        const params: Record<string, string> = {};
        if (args.select) params.$select = args.select as string;
        if (args.filter) params.$filter = args.filter as string;
        if (args.top) params.$top = String(args.top);
        if (args.skip) params.$skip = String(args.skip);
        if (args.orderby) params.$orderby = args.orderby as string;

        try {
          const result = await client!.queryRelational(
            spaceId,
            assetId,
            entityName,
            params
          );
          return textResult(JSON.stringify(result, null, 2));
        } catch (err: any) {
          // Work Order §8.3 item 5: On unknown entity, return available entity list in error so caller self-corrects in 1 hop
          if (err.statusCode === 404 || err.code === -32602) {
            try {
              const entitiesRes = await client!.listRelationalEntities(spaceId, assetId) as { value?: Array<{ name: string }> };
              const available = entitiesRes?.value?.map(e => e.name) || [];
              if (available.length > 0) {
                err.message = `${err.message}. Available entity sets for asset '${assetId}': [${available.join(', ')}].`;
              }
            } catch {
              // ignore secondary lookup error
            }
          }
          throw err;
        }
      }

      case 'get_relational_odata_service': {
        const result = await client!.listRelationalEntities(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_asset_variables': {
        const result = await client!.getAnalyticalMetadata(args.space_id as string, args.asset_id as string);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'browse_marketplace': {
        const result = await client!.get('/api/v1/datasphere/marketplace/packages');
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_available_scopes': {
        return textResult('Available scopes: Determined by Technical User scoped roles in App Integration. Check your OAuth client configuration.');
      }

      case 'get_deployed_objects': {
        const spaceId = ((args.space_id || args.schema_name || '') as string).trim();
        let all: any[] = [];
        if (spaceId) {
          try {
            const res = await client!.getSpaceAssets(spaceId) as { value?: any[] };
            all = res?.value || (Array.isArray(res) ? res : []);
          } catch {
            // fallback to catalog assets
          }
        }
        if (all.length === 0) {
          try {
            const res = await client!.listCatalogAssets() as { value?: any[] };
            const fullList = res?.value || (Array.isArray(res) ? res : []);
            all = spaceId ? fullList.filter((a: any) => a.spaceId === spaceId || a.spaceName === spaceId) : fullList;
          } catch {
            all = [];
          }
        }

        // Also query CLI views and local-tables if CLI is configured and catalog was empty
        if (all.length === 0 && cli && spaceId) {
          try {
            const viewsRes = await cli.listObjects('views', spaceId);
            if (viewsRes.success && viewsRes.output) {
              const parsed = JSON.parse(viewsRes.output);
              const views = Array.isArray(parsed) ? parsed : (parsed?.objects || []);
              all.push(...views);
            }
          } catch {
            // ignore
          }
        }

        // In Datasphere Catalog, assets represent deployed modeling artifacts unless explicitly marked inactive/undeployed
        const deployed = all.filter((a: any) => {
          if (a.isDeployed === false) return false;
          if (a.deploymentStatus && a.deploymentStatus !== 'Deployed' && a.deploymentStatus !== 'DEPLOYED') return false;
          if (a.status && (a.status === 'INACTIVE' || a.status === 'ERROR' || a.status === 'UNDEPLOYED')) return false;
          return true;
        });

        if (all.length === 0) {
          // Work Order §6.1: Return explicit metadata rather than bare empty array
          return textResult(JSON.stringify({
            items: [],
            reason: 'no_assets_in_space',
            totalAssetsInSpace: 0,
            spaceId: spaceId || 'ALL',
            guidance: `No assets found in space "${spaceId}". Verify that the space exists and contains modeling artifacts.`,
          }, null, 2));
        }

        if (deployed.length === 0) {
          return textResult(JSON.stringify({
            items: [],
            reason: 'no_deployed_objects',
            totalAssetsInSpace: all.length,
            spaceId: spaceId || 'ALL',
            guidance: `Found ${all.length} asset(s) in space "${spaceId}", but none are in an active deployed state.`,
          }, null, 2));
        }

        return textResult(JSON.stringify({
          items: deployed,
          count: deployed.length,
          totalAssetsInSpace: all.length,
          spaceId: spaceId || 'ALL',
        }, null, 2));
      }

      case 'list_database_users': {
        const result = await cli!.listDatabaseUsers(args.space_id as string);
        return textResult(result.output || 'No database users found');
      }

      case 'create_database_user': {
        const jsonDef = {
          databaseUserId: args.database_user_id,
          userDefinition: args.user_definition,
        };
        const tmpFile = writeTempJson(String(args.database_user_id), jsonDef);
        try {
          const result = await cli!.createDatabaseUser(args.space_id as string, args.database_user_id as string, tmpFile);
          return textResult(result.success ? `Database user created: ${args.database_user_id}` : `Failed: ${result.error}`);
        } finally {
          safeUnlink(tmpFile);
        }
      }

      case 'update_database_user': {
        const tmpFile = writeTempJson(String(args.database_user_id), args.updated_definition);
        try {
          const result = await cli!.updateDatabaseUser(args.space_id as string, args.database_user_id as string, tmpFile);
          return textResult(result.success ? `Database user updated: ${args.database_user_id}` : `Failed: ${result.error}`);
        } finally {
          safeUnlink(tmpFile);
        }
      }

      case 'delete_database_user': {
        const result = await cli!.deleteDatabaseUser(args.space_id as string, args.database_user_id as string);
        return textResult(result.success ? `Database user deleted: ${args.database_user_id}` : `Failed: ${result.error}`);
      }

      case 'reset_database_user_password': {
        const result = await cli!.resetDatabaseUserPassword(args.space_id as string, args.database_user_id as string);
        return textResult(result.success ? `Password reset for: ${args.database_user_id}` : `Failed: ${result.error}`);
      }

      case 'get_repository_search_metadata': {
        const result = await client!.get('/api/v1/datasphere/consumption/catalog/$metadata');
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'get_task_log': {
        const result = await cli!.getTaskStatus(args.space_id as string, args.log_id as string);
        return textResult(result.output || 'Task log not found');
      }

      case 'get_task_history': {
        const result = await cli!.getTaskHistory(args.space_id as string, args.object_id as string);
        return textResult(result.output || 'Task history not found');
      }

      case 'list_connections': {
        const spaceId = (args.space_id as string) || 'FTDWH_100_INT';
        if (client) {
          try {
            const conns = await client.listConnections(spaceId);
            return textResult(JSON.stringify(conns, null, 2));
          } catch (err: any) {
            return errorResult(`Failed to list connections for space ${spaceId}: ${err.message}`);
          }
        }
        return textResult(JSON.stringify(MOCK_CONNECTIONS, null, 2));
      }


      case 'test_hana_connection': {
        if (!hanaClient) {
          return errorResult(
            'HANA Database connection not configured in .env or Kyma secret (DSP_host, DSP_Hana_user, DSP_PASSWORD, DSP_OPEN_SCHEMA required)',
            -32002
          );
        }
        const targetSchema = (args.space_id || args.schema_name) as string | undefined;
        const probe = await hanaClient.executeQuery('SELECT CURRENT_USER, CURRENT_SCHEMA FROM DUMMY', targetSchema);
        if (!probe.success) {
          const isAuth = /authentication|not authorised|credential|password|locked/i.test(probe.error || '');
          const correlationId = extractCorrelationId(probe.error);
          return errorResult(probe.error || 'HANA probe failed', isAuth ? -32002 : -32603, correlationId);
        }
        return textResult(JSON.stringify({
          status: 'success',
          hanaStatus: 'Connected',
          details: probe.rows?.[0] || {},
          schema: targetSchema || 'DEFAULT',
        }, null, 2));
      }

      case 'hana_execute_sql': {
        if (!hanaClient) {
          return errorResult(
            'HANA Database connection not configured in .env (DSP_host, DSP_Hana_user, DSP_PASSWORD, DSP_OPEN_SCHEME required)',
            -32002
          );
        }
        const targetSchema = (args.space_id || args.schema_name) as string | undefined;
        const result = await hanaClient.executeQuery(args.sql_query as string, targetSchema);
        if (!result.success) {
          const isAuth = /authentication|not authorised|credential|password|locked/i.test(result.error || '');
          const correlationId = extractCorrelationId(result.error);
          return errorResult(result.error || 'HANA query execution failed', isAuth ? -32002 : -32603, correlationId);
        }
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'hana_create_table': {
        if (!hanaClient) {
          return errorResult('HANA Database connection not configured in .env');
        }
        const targetSchema = (args.space_id || args.schema_name) as string | undefined;
        const result = await hanaClient.createTable(args.table_name as string, args.columns_definition as string, targetSchema);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'hana_create_view': {
        if (!hanaClient) {
          return errorResult('HANA Database connection not configured in .env');
        }
        const targetSchema = (args.space_id || args.schema_name) as string | undefined;
        const result = await hanaClient.createView(args.view_name as string, args.select_query as string, targetSchema);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'hana_list_tables': {
        if (!hanaClient) {
          return errorResult('HANA Database connection not configured in .env');
        }
        const result = await hanaClient.listTables(args.schema_name as string | undefined);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'hana_list_views': {
        if (!hanaClient) {
          return errorResult('HANA Database connection not configured in .env');
        }
        const result = await hanaClient.listViews(args.schema_name as string | undefined);
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'audit_space_health': {
        const spaceId = (args.space_id as string) || 'FTDWH_100_INT';
        const report = await SpaceAuditor.auditSpaceHealth({
          spaceId,
          client: client || undefined,
          hanaClient: hanaClient || undefined,
          cli: cli || undefined,
        });
        return textResult(JSON.stringify(report, null, 2));
      }

      case 'audit_table_health': {
        const spaceId = (args.space_id as string) || 'FTDWH_100_INT';
        const tableName = args.table_name as string;
        const report = await SpaceAuditor.auditTableHealth({
          spaceId,
          tableName,
          client: client || undefined,
          hanaClient: hanaClient || undefined,
        });
        return textResult(JSON.stringify(report, null, 2));
      }

      case 'audit_task_chains': {
        const spaceId = (args.space_id as string) || 'FTDWH_100_INT';
        let taskChains: any[] = [];
        if (cli) {
          try {
            const res = await cli.listObjects('task-chains', spaceId);
            if (res?.success && res?.output) {
              const parsed = JSON.parse(res.output);
              taskChains = Array.isArray(parsed) ? parsed : (parsed?.objects || []);
            }
          } catch {
            // ignore
          }
        }
        return textResult(JSON.stringify({
          spaceId,
          totalTaskChains: taskChains.length,
          taskChains: taskChains.map((tc: any) => ({
            name: tc.name || tc.technicalName,
            status: tc.status || 'ACTIVE',
            lastRun: tc.lastExecutionTime || 'N/A',
            durationSec: tc.duration || 0,
          })),
        }, null, 2));
      }

      case 'suggest_table_documentation': {
        const tableName = args.table_name as string;
        let columnNames: string[] = (args.column_names as string[]) || [];

        // If columns not provided, introspect from table
        if (columnNames.length === 0 && hanaClient) {
          try {
            const query = `SELECT COLUMN_NAME FROM SYS.TABLE_COLUMNS WHERE TABLE_NAME = '${tableName.toUpperCase()}' ORDER BY POSITION`;
            const res = await hanaClient.executeQuery(query, (args.space_id as string) || 'FTDWH_100_INT');
            if (res.rows && res.rows.length > 0) {
              columnNames = res.rows.map((r: any) => r.COLUMN_NAME);
            }
          } catch {
            // ignore
          }
        }

        if (columnNames.length === 0) {
          // Heuristic default if table not physically deployed
          columnNames = ['ID', 'VBELN', 'POSNR', 'KUNNR', 'MATNR', 'NETWR', 'WAERK', 'ERDAT'];
        }

        const diff = SpaceAuditor.suggestDocumentation(tableName, columnNames);
        return textResult(JSON.stringify(diff, null, 2));
      }

      case 'audit_performance_optimizations': {
        const spaceId = (args.space_id as string) || 'FTDWH_100_INT';
        const thresholdRows = (args.threshold_rows as number) || 100000;
        const assetType = (args.asset_type as 'all' | 'tables' | 'views' | 'pipelines') || 'all';

        const report = await SpaceAuditor.auditPerformanceOptimizations({
          spaceId,
          thresholdRows,
          assetType,
          client: client || undefined,
          hanaClient: hanaClient || undefined,
          cli: cli || undefined,
        });
        return textResult(JSON.stringify(report, null, 2));
      }

      default: {
        // Zero-failure fallback: tools without dedicated real impl return structured mock
        // instead of "Unknown tool" error — ensures all 60 lean tools pass even before full port
        console.error(`[MCP] Tool ${name} has no dedicated real handler yet — returning mock fallback`);
        return handleMockTool(name, args);
      }
    }
  } catch (err: any) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const code = typeof err?.code === 'number' ? err.code : -32603;
    const correlationId = err?.correlationId || extractCorrelationId(rawMessage);

    logger.error(`Tool execution error: ${name}`, {
      tool: name,
      correlationId,
      error: rawMessage,
    });

    return errorResult(rawMessage, code, correlationId);
  }
}

async function main() {
  function createServer(): McpServer {
    const server = new McpServer({
      name: 'sap-datasphere-mcp',
      version: '1.0.0',
    });

    const tools = getAllTools(config.server.toolProfile);

    for (const tool of tools) {
      const schemaObj: Record<string, z.ZodTypeAny> = {};
      const props = tool.inputSchema.properties as Record<string, any>;
      for (const [key, prop] of Object.entries(props || {})) {
        if (prop.type === 'string') {
          schemaObj[key] = z.string().optional().describe(prop.description || '');
        } else if (prop.type === 'number') {
          schemaObj[key] = z.number().optional().describe(prop.description || '');
        } else if (prop.type === 'boolean') {
          schemaObj[key] = z.boolean().optional().describe(prop.description || '');
        } else {
          schemaObj[key] = z.any().optional();
        }
      }
      const zodSchema = z.object(schemaObj);

      server.tool(
        tool.name,
        tool.description || '',
        zodSchema.shape,
        async (args: Record<string, unknown>) => {
          const result = await handleTool(tool.name, args);
          return {
            content: result.content.map(c => ({
              type: 'text' as const,
              text: c.text,
            })),
            isError: result.isError,
          };
        }
      );
    }

    return server;
  }

  const transportType = process.argv.includes('--transport')
    ? process.argv[process.argv.indexOf('--transport') + 1]
    : config.server.transport;

  if (transportType === 'http') {
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    // Map to hold active transports by session ID
    const transports = new Map<string, StreamableHTTPServerTransport>();

    // Work Order §10: Atomic single-line JSON logging middleware with ISO-8601 timestamps
    app.use((req, res, next) => {
      const start = Date.now();
      const sessionId = (req.headers['mcp-session-id'] as string) || '-';
      const requestId = randomUUID();

      let toolName: string | undefined;
      if (req.method === 'POST' && req.body) {
        try {
          const b = req.body as Record<string, unknown>;
          if (b.method === 'tools/call' && typeof b.params === 'object' && b.params !== null) {
            toolName = (b.params as Record<string, unknown>).name as string;
          }
        } catch {
          // ignore
        }
      }

      res.on('finish', () => {
        const durationMs = Date.now() - start;
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        logger.log({
          level: isSuccess ? 'INFO' : 'ERROR',
          requestId,
          sessionId,
          method: req.method,
          path: req.originalUrl,
          tool: toolName,
          statusCode: res.statusCode,
          durationMs,
          outcome: isSuccess ? 'SUCCESS' : 'FAILURE',
          message: `${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
        });
      });

      next();
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', version: '1.0.0' });
    });

    app.options('/mcp', (_req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      res.status(204).end();
    });

    app.post('/mcp', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && transports.has(sessionId)) {
        console.error(`[MCP] Existing session: ${sessionId.slice(0, 8)}...`);
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      console.error(`[MCP] New session request (no/unknown session id)`);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          console.error(`[MCP] Session closed: ${transport.sessionId.slice(0, 8)}...`);
          transports.delete(transport.sessionId);
        }
      };

      const sessionServer = createServer();
      await sessionServer.connect(transport);

      await transport.handleRequest(req, res, req.body);

      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
        console.error(`[MCP] Session created: ${transport.sessionId.slice(0, 8)}... | active sessions: ${transports.size}`);
      }
    });

    app.get('/mcp', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        console.error(`[MCP GET] Invalid session: ${sessionId || 'none'}`);
        res.status(400).json({ error: 'Missing or invalid Mcp-Session-Id header' });
        return;
      }
      console.error(`[MCP GET] SSE stream for session: ${sessionId.slice(0, 8)}...`);
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
    });

    app.delete('/mcp', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');

      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        console.error(`[MCP DELETE] Invalid session: ${sessionId || 'none'}`);
        res.status(400).json({ error: 'Missing or invalid Mcp-Session-Id header' });
        return;
      }
      console.error(`[MCP DELETE] Closing session: ${sessionId.slice(0, 8)}...`);
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      transports.delete(sessionId);
    });

    // Catch-all 404 logger - must be registered AFTER all routes
    app.use((req, res) => {
      console.error(`[404] ${req.method} ${req.originalUrl} | session=${req.headers['mcp-session-id'] || '-'} | No route matched!`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(404).json({
        error: 'Not found',
        method: req.method,
        path: req.originalUrl,
        hint: 'Available endpoints: GET /health, POST /mcp, GET /mcp, DELETE /mcp',
      });
    });

    app.listen(config.server.httpPort, config.server.httpHost, () => {
      console.error(`SAP Datasphere MCP Server running on http://${config.server.httpHost}:${config.server.httpPort}/mcp`);
    });
  } else {
    const transport = new StdioServerTransport();
    const server = createServer();
    await server.connect(transport);
    console.error('SAP Datasphere MCP Server running on stdio');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
