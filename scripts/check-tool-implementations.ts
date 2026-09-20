import fs from 'node:fs';
import { getAllTools } from '../src/tools/registry.js';

function checkImplementations() {
  const serverCode = fs.readFileSync('src/server.ts', 'utf-8');
  const allTools = getAllTools('full');

  // Extract all case 'tool_name': in handleTool
  const handleToolBody = serverCode.substring(
    serverCode.indexOf('async function handleTool'),
    serverCode.indexOf('async function main()')
  );

  const implementedCases = new Set<string>();
  const caseMatches = [...handleToolBody.matchAll(/case\s+'([^']+)'\s*:/g)];
  for (const m of caseMatches) {
    implementedCases.add(m[1]);
  }

  console.log(`Total tools in registry: ${allTools.length}`);
  console.log(`Explicit case handlers in handleTool: ${implementedCases.size}\n`);

  const implementedNonCli: string[] = [];
  const mockFallbackNonCli: string[] = [];
  const cliDependent: string[] = [];

  const CLI_TOOL_NAMES = new Set([
    'create_space', 'create_local_table', 'create_view', 'deploy_object', 'delete_object',
    'create_user', 'list_users', 'create_database_user', 'list_database_users', 'update_database_user',
    'delete_database_user', 'reset_database_user_password', 'run_task_chain', 'list_task_chains',
    'get_task_status', 'get_task_log', 'get_task_history', 'deploy_view_to_datasphere'
  ]);

  for (const tool of allTools) {
    if (CLI_TOOL_NAMES.has(tool.name)) {
      cliDependent.push(tool.name);
    } else if (implementedCases.has(tool.name)) {
      implementedNonCli.push(tool.name);
    } else {
      mockFallbackNonCli.push(tool.name);
    }
  }

  console.log(`=== 1. IMPLEMENTED NON-CLI TOOLS (${implementedNonCli.length}) ===`);
  for (const name of implementedNonCli) {
    console.log(`  [REAL] ${name}`);
  }

  console.log(`\n=== 2. UNIMPLEMENTED / MOCK FALLBACK NON-CLI TOOLS (${mockFallbackNonCli.length}) ===`);
  for (const name of mockFallbackNonCli) {
    console.log(`  [MOCK FALLBACK] ${name}`);
  }

  console.log(`\n=== 3. CLI-DEPENDENT TOOLS (${cliDependent.length}) ===`);
  for (const name of cliDependent) {
    console.log(`  [CLI] ${name}`);
  }
}

checkImplementations();
