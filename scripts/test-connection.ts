/**
 * Test Connection Script
 * Safely tests real SAP Datasphere credentials and OData APIs locally.
 * NEVER prints or leaks client secrets or bearer tokens.
 */
import { config as dotenvConfig } from 'dotenv';
import { TokenManager } from '../src/auth/token-manager.js';
import { DatasphereClient } from '../src/api/client.js';
import { DatasphereCLI } from '../src/cli/datasphere-cli.js';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function runDiagnostic() {
  console.log('====================================================');
  console.log(' SAP Datasphere MCP - OData & Connectivity Test');
  console.log('====================================================\n');

  const baseUrl = process.env.DATASPHERE_BASE_URL;
  const clientId = process.env.DATASPHERE_CLIENT_ID;
  const clientSecret = process.env.DATASPHERE_CLIENT_SECRET;
  const tokenUrl = process.env.DATASPHERE_TOKEN_URL;
  const cliHost = process.env.DATASPHERE_CLI_HOST || baseUrl;

  console.log('[1/4] Checking Environment Configuration...');
  let envOk = true;

  if (!baseUrl) {
    console.error('  [MISSING] DATASPHERE_BASE_URL is not set in .env');
    envOk = false;
  } else {
    console.log(`  [OK] DATASPHERE_BASE_URL: ${baseUrl}`);
  }

  if (!tokenUrl) {
    console.error('  [MISSING] DATASPHERE_TOKEN_URL is not set in .env');
    envOk = false;
  } else {
    console.log(`  [OK] DATASPHERE_TOKEN_URL: ${tokenUrl}`);
    if (tokenUrl.includes('/osuth/')) {
      console.warn('  [WARNING] DATASPHERE_TOKEN_URL contains "/osuth/token" - did you mean "/oauth/token"?');
    }
  }

  if (!clientId) {
    console.error('  [MISSING] DATASPHERE_CLIENT_ID is not set in .env');
    envOk = false;
  } else {
    console.log(`  [OK] DATASPHERE_CLIENT_ID: configured (${clientId.length} chars)`);
  }

  if (!clientSecret) {
    console.error('  [MISSING] DATASPHERE_CLIENT_SECRET is not set in .env');
    envOk = false;
  } else {
    console.log(`  [OK] DATASPHERE_CLIENT_SECRET: configured (${clientSecret.length} chars, masked)`);
  }

  if (!envOk) {
    console.error('\n[FAIL] Missing required environment variables. Please check your .env file.\n');
    process.exitCode = 1;
    return;
  }

  console.log('\n[2/4] Testing OAuth 2.0 Token Acquisition...');
  const tokenManager = new TokenManager(tokenUrl!, clientId!, clientSecret!);
  let token = '';
  try {
    token = await tokenManager.getToken();
    console.log('  [PASS] OAuth token acquired successfully!');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [FAIL] Could not acquire OAuth token: ${sanitizeForLLM(msg)}`);
    console.error('  Resolution tip: Verify DATASPHERE_TOKEN_URL, CLIENT_ID, and CLIENT_SECRET in .env.');
    process.exitCode = 1;
    return;
  }

  console.log('\n[3/4] Testing SAP Datasphere OData APIs...');
  const client = new DatasphereClient({
    baseUrl: baseUrl!,
    tokenUrl: tokenUrl!,
    clientId: clientId!,
    clientSecret: clientSecret!,
    tenantId: process.env.DATASPHERE_TENANT_ID || '',
    cliHost: cliHost || baseUrl!,
  });

  // Test 3.1: Catalog Root (Service Document)
  try {
    const catalogRoot = await client.getCatalogRoot();
    console.log('  [PASS] OData Catalog Service Document reachable.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [INFO] OData Catalog root check: ${sanitizeForLLM(msg)}`);
  }

  // Test 3.2: Catalog Metadata ($metadata)
  try {
    const catalogMeta = await client.getCatalogMetadata();
    const isXml = typeof catalogMeta === 'string' && catalogMeta.includes('<edmx:Edmx');
    console.log(`  [PASS] OData Catalog $metadata reachable (${isXml ? 'EDMX XML format' : 'OData response'}).`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [INFO] OData Catalog $metadata check: ${sanitizeForLLM(msg)}`);
  }

  // Test 3.3: Spaces Collection
  try {
    const spacesResult = await client.listSpaces() as { value?: unknown[] };
    const spaces = Array.isArray(spacesResult?.value) ? spacesResult.value : [];
    console.log(`  [PASS] OData Spaces collection working! Found ${spaces.length} space(s).`);
    if (spaces.length > 0) {
      const spaceNames = spaces.slice(0, 5).map((s: any) => s.spaceName || s.id || s.name || JSON.stringify(s));
      console.log(`         Sample spaces: ${spaceNames.join(', ')}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [FAIL] OData Spaces collection failed: ${sanitizeForLLM(msg)}`);
  }

  // Test 3.4: Assets Collection
  try {
    const assetsResult = await client.listCatalogAssets() as { value?: unknown[] };
    const assets = Array.isArray(assetsResult?.value) ? assetsResult.value : [];
    console.log(`  [PASS] OData Catalog Assets collection working! Found ${assets.length} asset(s).`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [INFO] OData Catalog Assets check: ${sanitizeForLLM(msg)}`);
  }

  console.log('\n[4/4] Testing Datasphere CLI tool...');
  try {
    const cli = new DatasphereCLI(cliHost || baseUrl!);
    const spacesList = await cli.listSpaces();
    if (spacesList.success) {
      console.log('  [PASS] Datasphere CLI executed successfully.');
    } else {
      console.log(`  [INFO] CLI invocation status: ${spacesList.error || 'Check login credentials for CLI'}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [INFO] CLI check note: ${sanitizeForLLM(msg)}`);
  }

  console.log('\n====================================================');
  console.log(' OData & Connectivity check completed.');
  console.log(' All credentials remained strictly local on your machine.');
  console.log('====================================================\n');
}

runDiagnostic().catch((err) => {
  console.error('Diagnostic error:', sanitizeForLLM(String(err)));
  process.exitCode = 1;
});
