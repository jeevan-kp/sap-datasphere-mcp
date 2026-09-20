import { config as dotenvConfig } from 'dotenv';
import type { AppConfig } from './types/index.js';

dotenvConfig();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

import fs from 'fs';
import path from 'path';

function getRawEnv(name: string, fallback = ''): string {
  if (fs.existsSync('.env')) {
    try {
      const lines = fs.readFileSync('.env', 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${name}=`)) {
          let val = trimmed.substring(`${name}=`.length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          return val;
        }
      }
    } catch {
      // ignore
    }
  }
  return process.env[name] || fallback;
}

export function loadConfig(): AppConfig {
  const useMockData = optionalEnv('USE_MOCK_DATA', 'false') === 'true';
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

  // In mock or test mode, provide safe placeholder defaults if env vars are missing
  const getRequired = (name: string, mockDefault: string): string => {
    if (useMockData || isTest) {
      return optionalEnv(name, mockDefault);
    }
    return requireEnv(name);
  };

  const baseUrl = getRequired('DATASPHERE_BASE_URL', 'https://mock.datasphere.cloud.sap');

  const hanaHost = getRawEnv('DSP_host');
  const hanaUser = getRawEnv('DSP_Hana_user');
  const hanaPassword = getRawEnv('DSP_PASSWORD');
  const hanaSchema = getRawEnv('DSP_OPEN_SCHEME', hanaUser);
  const hanaPort = parseInt(getRawEnv('DSP_port', '443'), 10);

  const hanaConfig = hanaHost && hanaUser ? {
    host: hanaHost,
    port: hanaPort,
    user: hanaUser,
    password: hanaPassword,
    schema: hanaSchema,
  } : undefined;

  return {
    datasphere: {
      baseUrl,
      tenantId: optionalEnv('DATASPHERE_TENANT_ID', ''),
      clientId: getRequired('DATASPHERE_CLIENT_ID', 'mock-client-id'),
      clientSecret: getRequired('DATASPHERE_CLIENT_SECRET', 'mock-client-secret'),
      tokenUrl: getRequired('DATASPHERE_TOKEN_URL', 'https://mock.authentication.cloud.sap/oauth/token'),
      cliHost: optionalEnv('DATASPHERE_CLI_HOST', baseUrl),
    },
    server: {
      transport: (optionalEnv('MCP_TRANSPORT', 'stdio') as 'stdio' | 'http'),
      httpPort: parseInt(optionalEnv('MCP_HTTP_PORT', '8080'), 10),
      httpHost: optionalEnv('MCP_HTTP_HOST', '0.0.0.0'),
      httpAuthToken: optionalEnv('MCP_HTTP_AUTH_TOKEN', ''),
      logLevel: optionalEnv('LOG_LEVEL', 'INFO'),
      useMockData,
      toolProfile: (optionalEnv('DATASPHERE_TOOL_PROFILE', 'lean') as 'lean' | 'full'),
      exposeDiagnostics: optionalEnv('DATASPHERE_EXPOSE_DIAGNOSTICS', 'false') === 'true',
    },
    hana: hanaConfig,
  };
}
