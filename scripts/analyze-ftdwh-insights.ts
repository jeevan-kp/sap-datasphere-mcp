import { config as dotenvConfig } from 'dotenv';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function analyzeInsights() {
  const client = new DatasphereClient({
    baseUrl: process.env.DATASPHERE_BASE_URL!,
    clientId: process.env.DATASPHERE_CLIENT_ID!,
    clientSecret: process.env.DATASPHERE_CLIENT_SECRET!,
    tokenUrl: process.env.DATASPHERE_TOKEN_URL!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: process.env.DATASPHERE_BASE_URL!,
  });

  const space = 'FTDWH_100_INT';

  console.log('======================================================================');
  console.log(` DEEP DIVE & DATA INSIGHTS: Space "${space}"`);
  console.log('======================================================================\n');

  // 1. Analytical Model: New_Analytic_Model
  console.log('----------------------------------------------------------------------');
  console.log('1. ANALYTICAL MODEL: "New_Analytic_Model"');
  console.log('----------------------------------------------------------------------');
  try {
    const doc = await client.getAnalyticalServiceDocument(space, 'New_Analytic_Model') as any;
    console.log('Service Document Context:', doc?.['@odata.context']);
    const entitySet = doc?.value?.[0]?.name;
    console.log(`Entity Set Name: ${entitySet}`);

    const data = await client.queryAnalytical(space, 'New_Analytic_Model', entitySet, { '$top': '5' }) as any;
    const rows = data?.value || [];
    console.log(`\nSuccessfully queried ${rows.length} row(s) from Analytical Model:`);
    if (rows.length > 0) {
      console.log('Dimensions / Measures present in model:');
      console.log(Object.keys(rows[0]));
      console.log('\nSample Analytical Record:');
      console.log(JSON.stringify(rows[0], null, 2));
    }
  } catch (err: any) {
    console.error('Analytical error:', err.message);
  }

  // 2. Relational Fact View: fact_view
  console.log('\n----------------------------------------------------------------------');
  console.log('2. RELATIONAL FACT VIEW: "fact_view"');
  console.log('----------------------------------------------------------------------');
  try {
    const data = await client.queryRelational(space, 'fact_view', 'fact_view', { '$top': '3' }) as any;
    const rows = data?.value || [];
    console.log(`\nSuccessfully queried ${rows.length} row(s) from Fact View:`);
    if (rows.length > 0) {
      console.log('Columns:');
      console.log(Object.keys(rows[0]));
      console.log('\nSample Record:');
      console.log(JSON.stringify(rows[0], null, 2));
    }
  } catch (err: any) {
    console.error('Fact view error:', err.message);
  }

  // 3. Relational Table: 1LR_100_FTWPINV6_01
  console.log('\n----------------------------------------------------------------------');
  console.log('3. RELATIONAL INVENTORY TABLE: "1LR_100_FTWPINV6_01"');
  console.log('----------------------------------------------------------------------');
  try {
    const data = await client.queryRelational(space, '1LR_100_FTWPINV6_01', '_1LR_100_FTWPINV6_01', { '$top': '3' }) as any;
    const rows = data?.value || [];
    console.log(`\nSuccessfully queried ${rows.length} row(s) from 1LR_100_FTWPINV6_01:`);
    if (rows.length > 0) {
      console.log('Columns:');
      console.log(Object.keys(rows[0]));
      console.log('\nSample Record:');
      console.log(JSON.stringify(rows[0], null, 2));
    }
  } catch (err: any) {
    console.error('1LR table error:', err.message);
  }

  // 4. Hierarchy Dimension: HeirarichtDim
  console.log('\n----------------------------------------------------------------------');
  console.log('4. HIERARCHY DIMENSION VIEW: "HeirarichtDim"');
  console.log('----------------------------------------------------------------------');
  try {
    const data = await client.queryRelational(space, 'HeirarichtDim', 'HeirarichtDim', { '$top': '3' }) as any;
    const rows = data?.value || [];
    console.log(`\nSuccessfully queried ${rows.length} row(s) from HeirarichtDim:`);
    if (rows.length > 0) {
      console.log('Columns:');
      console.log(Object.keys(rows[0]));
      console.log('\nSample Record:');
      console.log(JSON.stringify(rows[0], null, 2));
    }
  } catch (err: any) {
    console.error('HeirarichtDim error:', err.message);
  }
}

analyzeInsights().catch(console.error);
