import { config as dotenvConfig } from 'dotenv';
import { execSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sanitizeForLLM } from '../src/security/sanitizer.js';

dotenvConfig();

async function checkSecretsFormat() {
  const clientId = process.env.DATASPHERE_CLIENT_ID!;
  const clientSecret = process.env.DATASPHERE_CLIENT_SECRET!;
  const tokenUrl = process.env.DATASPHERE_TOKEN_URL!;

  const localBin = path.resolve(process.cwd(), 'node_modules', '.bin');
  const env = {
    ...process.env,
    PATH: `${localBin}${path.delimiter}${process.env.PATH || ''}`,
  };

  const tmpSecrets = path.join(os.tmpdir(), `test_secrets_${Date.now()}.json`);
  const secretsData = {
    client_id: clientId,
    client_secret: clientSecret,
    token_url: tokenUrl,
    authorization_url: tokenUrl.replace('/token', '/authorize'),
  };

  fs.writeFileSync(tmpSecrets, JSON.stringify(secretsData, null, 2));

  try {
    const out = execSync(`datasphere config secrets check -s "${tmpSecrets}" 2>&1`, { encoding: 'utf-8', env });
    console.log('[CHECK RESULT]:', out.trim());
  } catch (err: any) {
    console.log('[CHECK ERROR]:', sanitizeForLLM(err.stdout || err.stderr || err.message));
  } finally {
    if (fs.existsSync(tmpSecrets)) fs.unlinkSync(tmpSecrets);
  }
}

checkSecretsFormat().catch(console.error);
