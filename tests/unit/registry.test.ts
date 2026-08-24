import { describe, it, expect } from 'vitest';
import { getAllTools, getToolByName } from '../../src/tools/registry.js';

describe('Tool Registry', () => {
  it('returns all tools in full profile', () => {
    const tools = getAllTools('full');
    expect(tools.length).toBeGreaterThanOrEqual(45);
  });

  it('returns lean tools in lean profile', () => {
    const tools = getAllTools('lean');
    expect(tools.length).toBeGreaterThan(0);
  });

  it('finds specific tool by name', () => {
    const tool = getToolByName('test_connection');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('test_connection');
  });

  it('returns undefined for unknown tool', () => {
    const tool = getToolByName('nonexistent_tool');
    expect(tool).toBeUndefined();
  });

  it('all tools have required properties', () => {
    const tools = getAllTools('full');
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('ABAP tools are present', () => {
    const tools = getAllTools('full');
    const abapTools = tools.filter(t => t.category === 'abap');
    expect(abapTools.length).toBeGreaterThanOrEqual(4);
  });

  it('BW query tools are present', () => {
    const tools = getAllTools('full');
    const bwTools = tools.filter(t => t.category === 'bw_queries');
    expect(bwTools.length).toBeGreaterThanOrEqual(5);
  });

  it('query tools are present', () => {
    const tools = getAllTools('full');
    const queryTools = tools.filter(t => t.category === 'queries');
    expect(queryTools.length).toBeGreaterThanOrEqual(3);
  });
});
