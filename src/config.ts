import { config as dotenvConfig } from 'dotenv';
import type { AppConfig } from './types/index.js';

dotenvConfig();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export function loadConfig(): AppConfig {
  return {
    datasphere: {
      baseUrl: requireEnv('DATASPHERE_BASE_URL'),
      tenantId: optionalEnv('DATASPHERE_TENANT_ID', ''),
      clientId: requireEnv('DATASPHERE_CLIENT_ID'),
      clientSecret: requireEnv('DATASPHERE_CLIENT_SECRET'),
      tokenUrl: requireEnv('DATASPHERE_TOKEN_URL'),
      cliHost: optionalEnv('DATASPHERE_CLI_HOST', requireEnv('DATASPHERE_BASE_URL')),
    },
    server: {
      transport: (optionalEnv('MCP_TRANSPORT', 'stdio') as 'stdio' | 'http'),
      httpPort: parseInt(optionalEnv('MCP_HTTP_PORT', '8080'), 10),
      httpHost: optionalEnv('MCP_HTTP_HOST', '0.0.0.0'),
      httpAuthToken: optionalEnv('MCP_HTTP_AUTH_TOKEN', ''),
      logLevel: optionalEnv('LOG_LEVEL', 'INFO'),
      useMockData: optionalEnv('USE_MOCK_DATA', 'false') === 'true',
      toolProfile: (optionalEnv('DATASPHERE_TOOL_PROFILE', 'lean') as 'lean' | 'full'),
      exposeDiagnostics: optionalEnv('DATASPHERE_EXPOSE_DIAGNOSTICS', 'false') === 'true',
    },
  };
}
