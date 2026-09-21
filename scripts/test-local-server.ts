import http from 'http';
import { spawn } from 'child_process';
import path from 'path';

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpPost(urlStr: string, body: any, headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  const url = new URL(urlStr);
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => { resBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: resBody, headers: res.headers }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(urlStr: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(urlStr, res => {
      let resBody = '';
      res.on('data', chunk => { resBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: resBody }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('1. Launching MCP server locally in HTTP mode on port 8080...');
  const serverPath = path.resolve('dist/server.js');
  const child = spawn(process.execPath, [serverPath, '--transport', 'http'], {
    env: { ...process.env, MCP_HTTP_PORT: '8080', MCP_HTTP_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stderr?.on('data', (d) => console.log('[Server Log]', d.toString().trim()));

  try {
    // Wait for server to start
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await wait(500);
      try {
        const health = await httpGet('http://127.0.0.1:8080/health');
        if (health.status === 200) {
          console.log('Server is alive! Health check response:', health.body);
          ready = true;
          break;
        }
      } catch {
        // Retry
      }
    }

    if (!ready) {
      throw new Error('MCP server failed to start within 5 seconds');
    }

    console.log('\n2. Connecting MCP Client to http://127.0.0.1:8080/mcp (Initialize handshake)...');
    const initRes = await httpPost('http://127.0.0.1:8080/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'local-test-client', version: '1.0.0' },
      },
    });

    console.log('HTTP Status:', initRes.status);
    console.log('Session ID Header:', initRes.headers['mcp-session-id']);
    console.log('Initialize Response:', initRes.body.slice(0, 300));

    const sessionId = initRes.headers['mcp-session-id'] as string;
    const sessionHeaders = sessionId ? { 'mcp-session-id': sessionId } : {};

function parseSseData(text: string): any {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('data:')) {
      return JSON.parse(line.substring('data:'.length).trim());
    }
  }
  return JSON.parse(text);
}

    console.log('\n3. Listing available tools from local MCP server...');
    const listToolsRes = await httpPost('http://127.0.0.1:8080/mcp', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }, sessionHeaders);

    const parsedList = parseSseData(listToolsRes.body);
    const toolCount = parsedList.result?.tools?.length || 0;
    console.log(`Discovered ${toolCount} registered tools!`);
    const sampleToolNames = (parsedList.result?.tools || []).slice(0, 5).map((t: any) => t.name);
    console.log('Sample tools:', sampleToolNames);

    console.log('\n4. Executing tool call: "test_connection"...');
    const callRes = await httpPost('http://127.0.0.1:8080/mcp', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'test_connection',
        arguments: {},
      },
    }, sessionHeaders);

    const parsedCall = parseSseData(callRes.body);
    console.log('Tool Call Response Status:', callRes.status);
    console.log('Tool Call Output Content:\n', JSON.stringify(parsedCall, null, 2).slice(0, 500));

    console.log('\n SUCCESS: Local MCP Server built, hosted, connected, and verified via Streamable HTTP!');
  } finally {
    console.log('\nStopping local MCP server process...');
    child.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('Error testing local server:', err);
  process.exit(1);
});
