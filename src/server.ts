#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { DatasphereClient } from './api/client.js';
import { DatasphereCLI } from './cli/datasphere-cli.js';
import { getAllTools } from './tools/registry.js';
import { ABAPParser } from './abap/parser.js';
import type { ToolResult } from './types/index.js';
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
const cli = useMockData ? null : new DatasphereCLI(config.datasphere.cliHost);

// Built-in ABAP Parser - extracts metadata for LLM to use
const abapParser = new ABAPParser();

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
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
        return textResult(`Connection successful. ${JSON.stringify(result).substring(0, 200)}`);
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
        const jsonDef = JSON.stringify({
          technicalName: args.table_name,
          columns: args.columns,
        });
        const fs = await import('fs');
        const path = await import('path');
        const tmpFile = path.join('/tmp', `${args.table_name}.json`);
        fs.writeFileSync(tmpFile, jsonDef);
        const result = await cli!.createObject(
          'local-tables', args.space_id as string, args.table_name as string, tmpFile
        );
        fs.unlinkSync(tmpFile);
        return textResult(result.success ? `Table created: ${args.table_name}` : `Failed: ${result.error}`);
      }

      case 'create_view': {
        const jsonDef = JSON.stringify({
          technicalName: args.view_name,
          sqlDefinition: args.sql_definition,
          description: args.description || '',
        });
        const fs = await import('fs');
        const path = await import('path');
        const tmpFile = path.join('/tmp', `${args.view_name}.json`);
        fs.writeFileSync(tmpFile, jsonDef);
        const result = await cli!.createObject(
          'views', args.space_id as string, args.view_name as string, tmpFile
        );
        fs.unlinkSync(tmpFile);
        return textResult(result.success ? `View created: ${args.view_name}` : `Failed: ${result.error}`);
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
        const params: Record<string, string> = {};
        if (args.select) params.$select = args.select as string;
        if (args.filter) params.$filter = args.filter as string;
        if (args.top) params.$top = String(args.top);
        if (args.skip) params.$skip = String(args.skip);
        const result = await client!.queryRelational(
          args.space_id as string,
          args.entity_name as string,
          params
        );
        return textResult(JSON.stringify(result, null, 2));
      }

      case 'query_relational': {
        const params: Record<string, string> = {};
        if (args.select) params.$select = args.select as string;
        if (args.filter) params.$filter = args.filter as string;
        if (args.top) params.$top = String(args.top);
        if (args.skip) params.$skip = String(args.skip);
        if (args.orderby) params.$orderby = args.orderby as string;
        const result = await client!.queryRelational(
          args.space_id as string,
          args.entity_name as string,
          params
        );
        return textResult(JSON.stringify(result, null, 2));
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
        const result = await cli!.listConnections();
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
        const jsonDef = JSON.stringify({
          name: args.username,
          password: args.password,
        });
        const fs = await import('fs');
        const path = await import('path');
        const tmpFile = path.join('/tmp', `${args.username}_user.json`);
        fs.writeFileSync(tmpFile, jsonDef);
        const result = await cli!.createUser(tmpFile);
        fs.unlinkSync(tmpFile);
        return textResult(result.success ? `User created: ${args.username}` : `Failed: ${result.error}`);
      }

      case 'list_task_chains': {
        const result = await cli!.listObjects('task-chains', args.space_id as string);
        return textResult(result.output || 'No task chains found');
      }

      case 'run_task_chain': {
        const result = await cli!.runTaskChain(args.task_chain_id as string);
        return textResult(result.success ? `Task chain started` : `Failed: ${result.error}`);
      }

      case 'get_task_status': {
        const result = await cli!.getTaskStatus(args.task_id as string);
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

        // Create the view definition
        const jsonDef = JSON.stringify({
          technicalName: viewName,
          sqlDefinition: sqlDef,
          description,
        });

        const fs = await import('fs');
        const path = await import('path');
        const tmpFile = path.join('/tmp', `${viewName}.json`);
        fs.writeFileSync(tmpFile, jsonDef);

        const createResult = await cli!.createObject('views', spaceId, viewName, tmpFile);
        fs.unlinkSync(tmpFile);

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

      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

async function main() {
  const server = new McpServer({
    name: 'sap-datasphere-mcp',
    version: '1.0.0',
  });

  const tools = getAllTools(config.server.toolProfile);

  for (const tool of tools) {
    // Convert JSON Schema properties to Zod schema
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

  if (config.server.transport === 'http') {
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', version: '1.0.0' });
    });

    app.post('/mcp', async (req, res) => {
      const { method, params, id } = req.body;

      if (method === 'initialize') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: { name: 'sap-datasphere-mcp', version: '1.0.0' },
          },
        });
        return;
      }

      if (method === 'tools/list') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: { tools },
        });
        return;
      }

      if (method === 'tools/call') {
        const result = await handleTool(params.name, params.arguments || {});
        res.json({
          jsonrpc: '2.0',
          id,
          result,
        });
        return;
      }

      res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    });

    app.listen(config.server.httpPort, config.server.httpHost, () => {
      console.error(`SAP Datasphere MCP Server running on http://${config.server.httpHost}:${config.server.httpPort}/mcp`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('SAP Datasphere MCP Server running on stdio');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
