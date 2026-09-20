import { config as dotenvConfig } from 'dotenv';
import { execSync } from 'child_process';
import path from 'node:path';
import { TokenManager } from '../src/auth/token-manager.js';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function debugCli() {
  const host = process.env.DATASPHERE_BASE_URL!;
  const tokenUrl = process.env.DATASPHERE_TOKEN_URL!;
  const clientId = process.env.DATASPHERE_CLIENT_ID!;
  const clientSecret = process.env.DATASPHERE_CLIENT_SECRET!;

  const tokenManager = new TokenManager(tokenUrl, clientId, clientSecret);
  const token = await tokenManager.getToken();

  const localBin = path.resolve(process.cwd(), 'node_modules', '.bin');
  const env = {
    ...process.env,
    PATH: `${localBin}${path.delimiter}${process.env.PATH || ''}`,
  };

  try {
    const out = execSync(
      `datasphere spaces list -H ${host} --access-token "${token}" --verbose 2>&1`,
      { encoding: 'utf-8', timeout: 30000, env }
    );
    console.log('[STDOUT/STDERR]:', sanitizeForLLM(out));
  } catch (err: any) {
    console.log('[ERROR STDOUT]:', sanitizeForLLM(err.stdout || ''));
    console.log('[ERROR STDERR]:', sanitizeForLLM(err.stderr || ''));
  }
}

debugCli().catch(console.error);
