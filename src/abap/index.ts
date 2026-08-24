/**
 * ABAP Skill - Real-time ABAP parsing and conversion
 * Built directly into the MCP server - no external dependencies
 */

export type ABAPFileType = 'CDS_VIEW' | 'ABAP_REPORT' | 'BW_TRANSFORMATION' | 'FUNCTION_MODULE' | 'UNKNOWN';

export interface ABAPField {
  name: string;
  alias?: string;
  isKey: boolean;
  dataType?: string;
  aggregate?: string;
  calculation?: string;
}

export interface ABAPJoin {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  table: string;
  alias?: string;
  condition: string;
}

export interface ABAPAnalysis {
  type: ABAPFileType;
  name: string;
  sourceTables: string[];
  joins: ABAPJoin[];
  fields: ABAPField[];
  filters: string[];
  aggregations: string[];
  groupBy: string[];
  annotations: string[];
  complexity: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface ConversionResult {
  sql: string;
  jsonDefinition: Record<string, unknown>;
  cliCommand: string;
  warnings: string[];
  metadata: {
    sourceTables: string[];
    outputFields: string[];
    complexity: string;
    viewName: string;
    spaceId: string;
  };
}

// Re-export submodules
export { ABAPLexer } from './lexer.js';
export { ABAPParser } from './parser.js';
export { CDSConverter } from './converters/cds.js';
export { ReportConverter } from './converters/report.js';
export { BWConverter } from './converters/bw.js';
export { FMConverter } from './converters/fm.js';
