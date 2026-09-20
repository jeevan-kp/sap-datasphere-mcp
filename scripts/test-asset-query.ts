import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function testAssetQuery() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  console.log('Testing asset relational metadata and data for 4VD_SUPPLIER in TLOGBI_401_MARKETS...');
  try {
    const meta = await client.getRelationalMetadata('TLOGBI_401_MARKETS', '4VD_SUPPLIER');
    console.log('[PASS] Relational metadata fetched successfully!');
    console.log('Metadata snippet (first 300 chars):', String(meta).slice(0, 300));
  } catch (err: any) {
    console.error('[FAIL] Relational metadata failed:', err.message);
  }

  try {
    const entities = await client.listRelationalEntities('TLOGBI_401_MARKETS', '4VD_SUPPLIER');
    console.log('[PASS] Relational entities service doc fetched!');
    console.log('Entities:', JSON.stringify(entities, null, 2).slice(0, 300));
  } catch (err: any) {
    console.error('[FAIL] Relational entities failed:', err.message);
  }

  try {
    // Query the entity
    const data = await client.queryRelational('TLOGBI_401_MARKETS', '4VD_SUPPLIER', '4VD_SUPPLIER', { '$top': '2' });
    console.log('[PASS] queryRelational succeeded!');
    console.log('Sample rows:', JSON.stringify(data, null, 2).slice(0, 400));
  } catch (err: any) {
    console.error('[FAIL] queryRelational failed:', err.message);
  }
}

testAssetQuery().catch(console.error);
