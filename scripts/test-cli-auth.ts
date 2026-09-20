import { config as dotenvConfig } from 'dotenv';
import { execSync } from 'child_process';
import path from 'node:path';
import { TokenManager } from '../src/auth/token-manager.js';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function testCliAuth() {
  const host = process.env.DATASPHERE_BASE_URL!;
  const tokenUrl = process.env.DATASPHERE_TOKEN_URL!;
  const clientId = process.env.DATASPHERE_CLIENT_ID!;
  const clientSecret = process.env.DATASPHERE_CLIENT_SECRET!;

  const tokenManager = new TokenManager(tokenUrl, clientId, clientSecret);
  const token = await tokenManager.getToken();
  console.log('[OK] Acquired OAuth token for technical user.');

  const localBin = path.resolve(process.cwd(), 'node_modules', '.bin');
  const env = {
    ...process.env,
    PATH: `${localBin}${path.delimiter}${process.env.PATH || ''}`,
  };

  console.log('Testing "datasphere config cache init -H <host> --access-token <token>"...');
  try {
    const initOut = execSync(
      `datasphere config cache init -H ${host} --access-token "${token}" --output json 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[CACHE INIT SUCCESS]:', initOut.trim());
  } catch (err: any) {
    console.log('[CACHE INIT ERROR]:', sanitizeForLLM(err.stdout || err.stderr || err.message));
  }

  console.log('\nTesting "datasphere spaces list --access-token <token>"...');
  try {
    const out = execSync(
      `datasphere spaces list -H ${host} --access-token "${token}" --output json 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[SUCCESS] CLI authenticated with access token!');
    console.log('Output snippet:', out.trim().slice(0, 300));
  } catch (err: any) {
    console.log('[RESULT] CLI stdout:', sanitizeForLLM(err.stdout || ''));
    console.log('[RESULT] CLI stderr:', sanitizeForLLM(err.stderr || ''));
  }
}

testCliAuth().catch(console.error);
