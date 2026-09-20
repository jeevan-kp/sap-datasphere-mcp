import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function testAnalyticalTools() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const space = 'TLOGBI_401_STANDARD';
  const asset = '4MA_401_GPC_ALTERNATIVE_PART';

  console.log(`Testing analytical tools on: ${space} / ${asset}...`);

  try {
    const doc = await client.getAnalyticalServiceDocument(space, asset) as any;
    console.log('[PASS] get_analytical_service_document ->', JSON.stringify(doc).slice(0, 100));
    const entitySet = doc?.value?.[0]?.name;
    console.log(`Entity set: ${entitySet}`);

    if (entitySet) {
      const data = await client.queryAnalytical(space, asset, entitySet, { '$top': '2' });
      console.log('[PASS] query_analytical_data ->', JSON.stringify(data).slice(0, 150));
    }
  } catch (err: any) {
    console.error('[FAIL] Analytical test:', err.message);
  }
}

testAnalyticalTools().catch(console.error);
