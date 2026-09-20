import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function inspectSchema() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const spacesRes = await client.listSpaces() as { value?: any[] };
  const spaces = spacesRes?.value || [];
  if (spaces.length > 0) {
    console.log('Space properties keys:', Object.keys(spaces[0]));
    console.log('Space sample:', JSON.stringify(spaces[0], null, 2));
  }

  const assetsRes = await client.listCatalogAssets() as { value?: any[] };
  const assets = assetsRes?.value || [];
  if (assets.length > 0) {
    console.log('\nAsset properties keys:', Object.keys(assets[0]));
    console.log('Asset sample:', JSON.stringify(assets[0], null, 2));
  }
}

inspectSchema().catch(console.error);
