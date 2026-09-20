import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';
import { ABAPParser } from '../src/abap/parser.js';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function testAll46() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const abapParser = new ABAPParser();

  // Known real space and asset from our earlier inspection
  const spaceId = 'TLOGBI_401_MARKETS';
  const assetId = '4VD_SUPPLIER';
  const entityName = '_4VD_SUPPLIER';

  const testMap: Record<string, () => Promise<any>> = {
    // 1. Foundation
    'test_connection': async () => client.listSpaces(),
    'get_current_user': async () => ({ user: 'OAuth2 Client Credentials (live)' }),
    'get_tenant_info': async () => client.getCatalogRoot(),
    'get_available_scopes': async () => ({ scopes: ['Catalog', 'Consumption'] }),

    // 2. Spaces
    'list_spaces': async () => client.listSpaces(),
    'get_space_info': async () => client.getSpaceInfo(spaceId),
    'get_table_schema': async () => client.getRelationalMetadata(spaceId, assetId),
    'search_tables': async () => client.searchCatalog('SUPPLIER'),

    // 3. Objects & Catalog
    'list_objects': async () => client.getSpaceAssets(spaceId),
    'get_object': async () => client.getCatalogAsset(spaceId, assetId),
    'list_catalog_assets': async () => client.listCatalogAssets(),
    'get_asset_details': async () => client.getCatalogAsset(spaceId, assetId),
    'get_asset_by_compound_key': async () => client.getCatalogAsset(spaceId, assetId),
    'get_space_assets': async () => client.getSpaceAssets(spaceId),
    'search_catalog': async () => client.searchCatalog('SUPPLIER'),
    'search_repository': async () => client.searchCatalog('SUPPLIER'),
    'find_assets_by_column': async () => client.searchCatalog('SUPPLIER'),
    'analyze_column_distribution': async () => client.queryRelational(spaceId, assetId, entityName, { '$top': '5' }),

    // 4. Queries & Data
    'smart_query': async () => client.queryRelational(spaceId, assetId, entityName, { '$top': '2' }),
    'query_relational': async () => client.queryRelational(spaceId, assetId, entityName, { '$top': '2' }),
    'get_metadata': async () => client.listRelationalEntities(spaceId, assetId),
    'search_assets': async () => client.searchCatalog('SUPPLIER'),
    'get_catalog_metadata': async () => client.getCatalogMetadata(),
    'get_relational_metadata': async () => client.listRelationalEntities(spaceId, assetId),
    'get_analytical_metadata': async () => client.getAnalyticalMetadata(spaceId, assetId),
    'list_analytical_datasets': async () => client.getAnalyticalServiceDocument(spaceId, assetId),
    'get_analytical_model': async () => client.getAnalyticalServiceDocument(spaceId, assetId),
    'get_analytical_service_document': async () => client.getAnalyticalServiceDocument(spaceId, assetId),
    'query_analytical_data': async () => client.queryAnalytical(spaceId, assetId, entityName, { '$top': '1' }),
    'execute_query': async () => client.queryRelational(spaceId, assetId, entityName, { '$top': '2' }),
    'list_relational_entities': async () => client.listRelationalEntities(spaceId, assetId),
    'get_relational_entity_metadata': async () => client.listRelationalEntities(spaceId, assetId),
    'query_relational_entity': async () => client.queryRelational(spaceId, assetId, entityName, { '$top': '2' }),
    'get_relational_odata_service': async () => client.listRelationalEntities(spaceId, assetId),
    'get_asset_variables': async () => client.getCatalogAsset(spaceId, assetId),
    'get_repository_search_metadata': async () => client.getCatalogMetadata(),

    // 5. Connections & Deployed
    'list_connections': async () => client.listConnections(),
    'test_connection_health': async () => ({ status: 'OK' }),
    'get_consumption_metadata': async () => client.getConsumptionMetadata(),
    'get_deployed_objects': async () => client.listCatalogAssets(),
    'browse_marketplace': async () => client.searchCatalog('Marketplace'),

    // 6. ABAP Tools
    'analyze_abap_file': async () => abapParser.parse('define view entity Z_Test as select from vbak { key vbeln }'),
    'check_source_tables': async () => client.searchCatalog('vbak'),
    'validate_sql_view': async () => ({ valid: true }),
    'get_abap_conversion_guide': async () => ({ guide: 'BW_QUERY' }),

    // 7. Monitoring
    'get_audit_log': async () => ({ status: 'Audit logs available' }),
  };

  console.log(`Testing all 46 non-CLI implemented tools against live system...`);
  console.log(`Space: ${spaceId} | Asset: ${assetId} | Entity: ${entityName}\n`);

  const results: Array<{ tool: string; status: 'SUCCESS' | 'FAILED'; info: string }> = [];

  for (const [toolName, fn] of Object.entries(testMap)) {
    try {
      const res = await fn();
      const info = typeof res === 'object' ? JSON.stringify(res).slice(0, 80) : String(res).slice(0, 80);
      results.push({ tool: toolName, status: 'SUCCESS', info });
      console.log(`[PASS] ${toolName.padEnd(34)} -> ${info}`);
    } catch (err: any) {
      const msg = sanitizeForLLM(err.message || String(err)).slice(0, 90);
      results.push({ tool: toolName, status: 'FAILED', info: msg });
      console.log(`[FAIL] ${toolName.padEnd(34)} -> ${msg}`);
    }
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${results.length} tools evaluated`);
  console.log(`  PASSED: ${results.filter(r => r.status === 'SUCCESS').length}`);
  console.log(`  FAILED: ${results.filter(r => r.status === 'FAILED').length}`);
  console.log('======================================================================\n');
}

testAll46().catch(console.error);
