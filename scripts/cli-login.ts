import { config as dotenvConfig } from 'dotenv';
import { execSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function loginTechnicalUser() {
  console.log('====================================================');
  console.log(' Logging in to Datasphere CLI via Technical User');
  console.log('====================================================\n');

  const host = process.env.DATASPHERE_BASE_URL!;
  const clientId = process.env.DATASPHERE_CLIENT_ID!;
  const clientSecret = process.env.DATASPHERE_CLIENT_SECRET!;
  const tokenUrl = process.env.DATASPHERE_TOKEN_URL!;

  const localBin = path.resolve(process.cwd(), 'node_modules', '.bin');
  const env = {
    ...process.env,
    PATH: `${localBin}${path.delimiter}${process.env.PATH || ''}`,
  };

  // Create temporary secrets file strictly on disk for login
  const tmpSecrets = path.join(os.tmpdir(), `ds_secrets_${Date.now()}.json`);
  const secretsData = {
    client_id: clientId,
    client_secret: clientSecret,
    token_url: tokenUrl,
    authorization_url: tokenUrl.replace('/token', '/authorize'),
  };

  fs.writeFileSync(tmpSecrets, JSON.stringify(secretsData, null, 2));

  try {
    console.log('[1/3] Running "datasphere login" with client_credentials flow...');
    const loginOut = execSync(
      `datasphere login -H ${host} -s "${tmpSecrets}" -d client_credentials -F 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[PASS] Login command completed:');
    console.log(sanitizeForLLM(loginOut.trim()));
  } catch (err: any) {
    console.error('[FAIL] Login command returned error:');
    console.error(sanitizeForLLM(err.stdout || err.stderr || err.message));
  } finally {
    // Always remove temporary secrets file immediately
    try {
      if (fs.existsSync(tmpSecrets)) fs.unlinkSync(tmpSecrets);
    } catch {}
  }

  try {
    console.log('\n[2/3] Initializing CLI cache for host...');
    const cacheOut = execSync(
      `datasphere config cache init -H ${host} 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[PASS] CLI cache initialized.');
  } catch (err: any) {
    console.warn('[INFO] Cache init message:', sanitizeForLLM(err.stdout || err.stderr || err.message));
  }

  console.log('\n[3/3] Testing CLI commands with active session...');

  // Test spaces list / read
  try {
    console.log('Testing "datasphere spaces read --space FTDWH_100_INT"...');
    const spaceOut = execSync(
      `datasphere spaces read -H ${host} --space FTDWH_100_INT --output json 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[PASS] Space details from CLI:');
    console.log(sanitizeForLLM(spaceOut.trim()).slice(0, 500));
  } catch (err: any) {
    console.log('[INFO] Space read result:', sanitizeForLLM(err.stdout || err.stderr || err.message).slice(0, 300));
  }

  // Test objects list
  try {
    console.log('\nTesting "datasphere objects local-tables list --space FTDWH_100_INT"...');
    const objsOut = execSync(
      `datasphere objects local-tables list -H ${host} --space FTDWH_100_INT --output json 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[PASS] Local tables list from CLI:');
    console.log(sanitizeForLLM(objsOut.trim()).slice(0, 500));
  } catch (err: any) {
    console.log('[INFO] Objects list result:', sanitizeForLLM(err.stdout || err.stderr || err.message).slice(0, 300));
  }

  // Test tasks list
  try {
    console.log('\nTesting "datasphere tasks chains list --space FTDWH_100_INT"...');
    const tasksOut = execSync(
      `datasphere tasks chains list -H ${host} --space FTDWH_100_INT --output json 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[PASS] Task chains list from CLI:');
    console.log(sanitizeForLLM(tasksOut.trim()).slice(0, 500));
  } catch (err: any) {
    console.log('[INFO] Tasks list result:', sanitizeForLLM(err.stdout || err.stderr || err.message).slice(0, 300));
  }
}

loginTechnicalUser().catch((err) => {
  console.error('Fatal CLI login error:', sanitizeForLLM(String(err)));
});
