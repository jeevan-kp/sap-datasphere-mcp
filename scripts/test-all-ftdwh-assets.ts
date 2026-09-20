import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function testAllAssets() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const space = 'FTDWH_100_INT';
  const assetsRes = await client.getSpaceAssets(space) as any;
  const assets = assetsRes?.value || [];

  console.log(`Checking data query for all ${assets.length} assets in ${space}...`);

  for (const a of assets) {
    const isAnalytical = a.supportsAnalyticalQueries;
    const assetName = a.name;

    try {
      if (isAnalytical) {
        const doc = await client.getAnalyticalServiceDocument(space, assetName) as any;
        const entitySet = doc?.value?.[0]?.name || assetName;
        const data = await client.queryAnalytical(space, assetName, entitySet, { '$top': '1' }) as any;
        const rowCount = data?.value?.length || 0;
        console.log(`[ANALYTICAL SUCCESS] ${assetName} (rows returned: ${rowCount})`);
      } else {
        const entities = await client.listRelationalEntities(space, assetName) as any;
        const entityName = entities?.value?.[0]?.name || assetName;
        const data = await client.queryRelational(space, assetName, entityName, { '$top': '1' }) as any;
        const rowCount = data?.value?.length || 0;
        console.log(`[RELATIONAL SUCCESS] ${assetName} -> ${entityName} (rows returned: ${rowCount})`);
      }
    } catch (err: any) {
      console.log(`[QUERY FAILED] ${assetName} (${isAnalytical ? 'Analytical' : 'Relational'}): ${sanitizeForLLM(err.message).slice(0, 100)}`);
    }
  }
}

testAllAssets().catch(console.error);
