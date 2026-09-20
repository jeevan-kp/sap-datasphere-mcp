import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function inspectFtwh() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const targetSpace = 'FTDWH_100_INT';
  console.log(`\n=== Inspecting Space: "${targetSpace}" ===`);

  // Space Info
  try {
    const spaceInfo = await client.getSpaceInfo(targetSpace);
    console.log('Space Info:', JSON.stringify(spaceInfo, null, 2));
  } catch (err: any) {
    console.log('Space info note:', sanitizeForLLM(err.message));
  }

  // Assets in Space
  console.log(`\n=== 3. Listing Assets in Space: "${targetSpace}" ===`);
  const assetsRes = await client.getSpaceAssets(targetSpace) as { value?: any[] };
  const assets = assetsRes?.value || [];
  console.log(`Total assets in ${targetSpace}: ${assets.length}`);

  const relationalAssets = assets.filter(a => !a.supportsAnalyticalQueries);
  const analyticalAssets = assets.filter(a => a.supportsAnalyticalQueries);

  console.log(`  - Relational Tables/Views: ${relationalAssets.length}`);
  console.log(`  - Analytical Models:       ${analyticalAssets.length}`);

  if (assets.length === 0) {
    console.log('No assets found in this space.');
    return;
  }

  console.log('\nSample Assets list:');
  for (const a of assets.slice(0, 8)) {
    console.log(`  * ${a.name} (label: "${a.label}", analytical: ${a.supportsAnalyticalQueries}, params: ${a.hasParameters})`);
  }

  // Inspect sample relational asset
  if (relationalAssets.length > 0) {
    const sampleRel = relationalAssets[0];
    console.log(`\n=== 4. Relational Table/View Analysis: "${sampleRel.name}" ===`);
    try {
      const entities = await client.listRelationalEntities(targetSpace, sampleRel.name) as any;
      console.log('Relational Entity Sets:', JSON.stringify(entities, null, 2).slice(0, 300));
      const entityName = entities?.value?.[0]?.name || sampleRel.name;

      console.log(`Querying sample rows for entity "${entityName}"...`);
      const sampleData = await client.queryRelational(targetSpace, sampleRel.name, entityName, { '$top': '3' }) as any;
      const rows = sampleData?.value || [];
      console.log(`Retrieved ${rows.length} sample row(s):`);
      if (rows.length > 0) {
        console.log('Column count:', Object.keys(rows[0]).length);
        console.log('Columns:', Object.keys(rows[0]).join(', '));
        console.log('First row sample:', JSON.stringify(rows[0], null, 2).slice(0, 400));
      }
    } catch (err: any) {
      console.log('Relational query error:', sanitizeForLLM(err.message));
    }
  }

  // Inspect sample analytical model
  if (analyticalAssets.length > 0) {
    const sampleAna = analyticalAssets[0];
    console.log(`\n=== 5. Analytical Model Analysis: "${sampleAna.name}" ===`);
    try {
      const doc = await client.getAnalyticalServiceDocument(targetSpace, sampleAna.name) as any;
      console.log('Analytical Service Document:', JSON.stringify(doc, null, 2).slice(0, 300));
      const entitySet = doc?.value?.[0]?.name;

      if (entitySet) {
        console.log(`Querying analytical data on entity set "${entitySet}"...`);
        const anaData = await client.queryAnalytical(targetSpace, sampleAna.name, entitySet, { '$top': '3' }) as any;
        const rows = anaData?.value || [];
        console.log(`Retrieved ${rows.length} analytical row(s):`);
        if (rows.length > 0) {
          console.log('Dimensions / Measures:', Object.keys(rows[0]).join(', '));
          console.log('First analytical row sample:', JSON.stringify(rows[0], null, 2).slice(0, 400));
        }
      }
    } catch (err: any) {
      console.log('Analytical query error:', sanitizeForLLM(err.message));
    }
  }
}

inspectFtwh().catch(console.error);
