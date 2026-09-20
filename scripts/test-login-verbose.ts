import { config as dotenvConfig } from 'dotenv';
import { execSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function testLoginVerbose() {
  const host = process.env.DATASPHERE_BASE_URL!;
  const clientId = process.env.DATASPHERE_CLIENT_ID!;
  const clientSecret = process.env.DATASPHERE_CLIENT_SECRET!;
  const tokenUrl = process.env.DATASPHERE_TOKEN_URL!;

  const localBin = path.resolve(process.cwd(), 'node_modules', '.bin');
  const env = {
    ...process.env,
    PATH: `${localBin}${path.delimiter}${process.env.PATH || ''}`,
  };

  const tmpSecrets = path.join(os.tmpdir(), `test_login_sec_${Date.now()}.json`);
  const secretsData = {
    client_id: clientId,
    client_secret: clientSecret,
    token_url: tokenUrl,
    authorization_url: tokenUrl.replace('/token', '/authorize'),
  };

  fs.writeFileSync(tmpSecrets, JSON.stringify(secretsData, null, 2));

  // Try datasphere login with debug
  try {
    const out = execSync(
      `datasphere login -H ${host} -s "${tmpSecrets}" --authorization-flow client_credentials --force 2>&1`,
      { encoding: 'utf-8', timeout: 20000, env }
    );
    console.log('[OUTPUT]:', sanitizeForLLM(out.trim()));
  } catch (err: any) {
    console.log('[ERROR STDOUT]:', sanitizeForLLM(err.stdout || ''));
    console.log('[ERROR STDERR]:', sanitizeForLLM(err.stderr || ''));
    console.log('[ERROR MESSAGE]:', sanitizeForLLM(err.message || ''));
  } finally {
    if (fs.existsSync(tmpSecrets)) fs.unlinkSync(tmpSecrets);
  }
}

testLoginVerbose().catch(console.error);
