import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function testFilter() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const res = await client.get(`/api/v1/datasphere/consumption/catalog/assets?$filter=spaceName eq 'TLOGBI_401_MARKETS'&$top=5`) as any;
  console.log(`Assets in TLOGBI_401_MARKETS:`, res?.value?.length);
  if (res?.value?.length > 0) {
    console.log('Sample asset:', res.value[0].name, 'label:', res.value[0].label);
  }
}

testFilter().catch(console.error);
