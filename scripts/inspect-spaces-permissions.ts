import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function checkSpaces() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const res = await client.listSpaces() as { value?: any[] };
  const spaces = res?.value || [];
  console.log(`Total spaces returned: ${spaces.length}`);

  // Let's inspect which spaces have consumption privilege
  const workingSpaces: string[] = [];
  const deniedSpaces: string[] = [];

  for (const s of spaces) {
    const spaceId = s.spaceID || s.id || s.spaceName;
    try {
      await client.getSpaceInfo(spaceId);
      workingSpaces.push(spaceId);
      if (workingSpaces.length >= 3) break; // found some working spaces
    } catch (err: any) {
      deniedSpaces.push(spaceId);
    }
  }

  console.log(`Working spaces with Consumption permission:`, workingSpaces);
  console.log(`Spaces checked so far without Consumption permission:`, deniedSpaces.length);

  // Check catalog assets
  const assetsRes = await client.listCatalogAssets() as { value?: any[] };
  const assets = assetsRes?.value || [];
  console.log(`Total catalog assets returned: ${assets.length}`);
  if (assets.length > 0) {
    console.log('Sample asset spaces:');
    const spaceSet = new Set(assets.map(a => a.spaceID || a.spaceId));
    console.log([...spaceSet].slice(0, 10));
    console.log('First asset sample structure:');
    const first = assets[0];
    console.log({
      id: first.assetID || first.id,
      name: first.technicalName || first.name,
      space: first.spaceID || first.spaceId,
      type: first.type || first.artifactType,
    });
  }
}

checkSpaces().catch(console.error);
