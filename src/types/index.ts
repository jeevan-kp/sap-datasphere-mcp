export interface DatasphereConfig {
  baseUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  cliHost: string;
}

export interface ServerConfig {
  transport: 'stdio' | 'http';
  httpPort: number;
  httpHost: string;
  httpAuthToken: string;
  logLevel: string;
  useMockData: boolean;
  toolProfile: 'lean' | 'full';
  exposeDiagnostics: boolean;
}

export interface AppConfig {
  datasphere: DatasphereConfig;
  server: ServerConfig;
}

export interface OAuthToken {
  accessToken: string;
  expiresAt: number;
  tokenType: string;
}

export interface DatasphereSpace {
  id: string;
  displayName: string;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
  owner?: string;
  region?: string;
}

export interface DatasphereObject {
  name: string;
  type: string;
  spaceId: string;
  displayName?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  createdAt?: string;
  modifiedAt?: string;
}

export interface DatasphereConnection {
  name: string;
  type: string;
  displayName?: string;
  description?: string;
  status?: 'OK' | 'ERROR' | 'UNKNOWN';
  parameters?: Record<string, string>;
}

export interface ABAPAnalysis {
  type: 'CDS_VIEW' | 'ABAP_REPORT' | 'BW_TRANSFORMATION' | 'FUNCTION_MODULE' | 'UNKNOWN';
  name: string;
  sourceTables: string[];
  joins: ABAPJoin[];
  fields: ABAPField[];
  filters: string[];
  aggregations: string[];
  annotations: string[];
  complexity: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface ABAPJoin {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
  table: string;
  on: string;
}

export interface ABAPField {
  name: string;
  alias?: string;
  type?: string;
  key?: boolean;
  aggregate?: string;
  calculation?: string;
}

export interface ConversionConfig {
  abapContent: string;
  fileType: 'CDS_VIEW' | 'ABAP_REPORT' | 'BW_TRANSFORMATION' | 'FUNCTION_MODULE';
  targetName: string;
  spaceId: string;
  includeFields?: string[];
  excludeFields?: string[];
  calculatedFields?: CalculatedField[];
  filters?: string[];
  aggregations?: AggregationConfig[];
}

export interface CalculatedField {
  name: string;
  expression: string;
  type?: string;
}

export interface AggregationConfig {
  field: string;
  function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
  groupBy?: string[];
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

export interface DeployConfig {
  spaceId: string;
  objectName: string;
  objectType: 'local-table' | 'view' | 'analytic-model' | 'data-flow';
  definition: object;
}

export interface DeployResult {
  status: 'success' | 'error';
  objectName: string;
  spaceId: string;
  url?: string;
  error?: string;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
