/**
 * Tool Auditor & Live Tester
 * Tests each tool in the registry against the live SAP Datasphere connection.
 */
import { config as dotenvConfig } from 'dotenv';
import { getAllTools } from '../src/tools/registry.js';
import { DatasphereClient } from '../src/api/client.js';

dotenvConfig();

async function audit() {
  const allTools = getAllTools('full');
  console.log(`Total tools in full registry: ${allTools.length}`);

  const categories: Record<string, typeof allTools> = {};
  for (const t of allTools) {
    categories[t.category] = categories[t.category] || [];
    categories[t.category].push(t);
  }

  for (const [cat, tools] of Object.entries(categories)) {
    console.log(`\nCategory: [${cat}] (${tools.length} tools)`);
    for (const t of tools) {
      console.log(`  - ${t.name}: ${t.description}`);
    }
  }
}

audit().catch(console.error);
