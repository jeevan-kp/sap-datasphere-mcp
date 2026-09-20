import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function findAnalytical() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const res = await client.listCatalogAssets() as any;
  const assets = res?.value || [];
  const analytical = assets.filter((a: any) => a.supportsAnalyticalQueries === true);
  console.log(`Total analytical assets found: ${analytical.length}`);
  if (analytical.length > 0) {
    const a = analytical[0];
    console.log(`Sample Analytical Asset: space=${a.spaceName}, name=${a.name}, url=${a.assetAnalyticalDataUrl}`);
  }
}

findAnalytical().catch(console.error);
