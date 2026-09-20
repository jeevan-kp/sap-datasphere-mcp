import hdb from 'hdb';
import type { HanaConfig } from '../types/index.js';
import { sanitizeForLLM } from '../security/sanitizer.js';

export interface HanaQueryResult {
  success: boolean;
  rows?: any[];
  rowCount?: number;
  message?: string;
  error?: string;
}

export class HanaClient {
  private client: any = null;
  private config: HanaConfig;

  constructor(config: HanaConfig) {
    this.config = config;
  }

  get schema(): string {
    return this.config.schema;
  }

  private async getClient(): Promise<any> {
    if (this.client && this.client.readyState === 'connected') {
      return this.client;
    }

    const client = hdb.createClient({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      useTLS: true,
    });

    await new Promise<void>((resolve, reject) => {
      client.connect((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.client = client;
    return this.client;
  }

  /**
   * Checks whether a given schema is authorized for write operations.
   * By default, access is granted to the configured DSP_OPEN_SCHEME and any schema within the FTDWH space (e.g. FTDWH_100_INT).
   */
  isSchemaAllowed(schema: string): boolean {
    const s = schema.trim().toUpperCase();
    if (s === 'SYS' || s.startsWith('_SYS_')) {
      return false;
    }
    if (s === this.config.schema.toUpperCase()) {
      return true;
    }
    if (s.startsWith('FTDWH')) {
      return true;
    }
    return false;
  }

  /**
   * Enforces that write/DDL operations are strictly restricted to authorized schemas (FTDWH space / DSP_OPEN_SCHEME).
   */
  private validateSchemaIsolation(sql: string, explicitSchema?: string): void {
    if (explicitSchema && !this.isSchemaAllowed(explicitSchema)) {
      throw new Error(
        `Security Policy Violation: Write operations are restricted strictly to authorized schemas (default: "${this.config.schema}" in FTDWH space). Modification of schema "${explicitSchema}" is prohibited.`
      );
    }

    const trimmed = sql.trim();
    const writeKeywords = /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|REPLACE)\b/i;
    
    if (writeKeywords.test(trimmed)) {
      // Check if another schema is explicitly specified (e.g., "OTHER_SCHEMA"."TABLE" or OTHER_SCHEMA.TABLE)
      const schemaMatch = trimmed.match(/(?:INTO|TABLE|VIEW|UPDATE|FROM)\s+["']?([A-Za-z0-9_#]+)["']?\./i);
      if (schemaMatch) {
        const targetSchema = schemaMatch[1];
        if (!this.isSchemaAllowed(targetSchema)) {
          throw new Error(
            `Security Policy Violation: Write operations are restricted strictly to authorized schemas (default: "${this.config.schema}" in FTDWH space). Modification of schema "${targetSchema}" is prohibited.`
          );
        }
      }
    }
  }

  async executeQuery(sql: string, targetSchema?: string): Promise<HanaQueryResult> {
    try {
      const effectiveSchema = (targetSchema && this.isSchemaAllowed(targetSchema)) ? targetSchema : this.config.schema;
      this.validateSchemaIsolation(sql, effectiveSchema);
      const client = await this.getClient();

      // Ensure the session is set to the authorized schema
      await new Promise<void>((resolve, reject) => {
        client.exec(`SET SCHEMA "${effectiveSchema}"`, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const rows = await new Promise<any[]>((resolve, reject) => {
        client.exec(sql, (err: any, res: any) => {
          if (err) reject(err);
          else resolve(res || []);
        });
      });

      return {
        success: true,
        rows: Array.isArray(rows) ? rows : [],
        rowCount: Array.isArray(rows) ? rows.length : undefined,
        message: 'Query executed successfully',
      };
    } catch (err: any) {
      return {
        success: false,
        error: sanitizeForLLM(err.message || String(err)),
      };
    }
  }

  async createTable(tableName: string, columnDefinitions: string, targetSchema?: string): Promise<HanaQueryResult> {
    const effectiveSchema = (targetSchema && this.isSchemaAllowed(targetSchema)) ? targetSchema : this.config.schema;
    const safeName = tableName.replace(/[^A-Za-z0-9_#]/g, '');
    const sql = `CREATE COLUMN TABLE "${effectiveSchema}"."${safeName}" (${columnDefinitions})`;
    return this.executeQuery(sql, effectiveSchema);
  }

  async createView(viewName: string, selectQuery: string, targetSchema?: string): Promise<HanaQueryResult> {
    const effectiveSchema = (targetSchema && this.isSchemaAllowed(targetSchema)) ? targetSchema : this.config.schema;
    const safeName = viewName.replace(/[^A-Za-z0-9_#]/g, '');
    const sql = `CREATE VIEW "${effectiveSchema}"."${safeName}" AS ${selectQuery}`;
    return this.executeQuery(sql, effectiveSchema);
  }

  async listTables(targetSchema?: string): Promise<HanaQueryResult> {
    const effectiveSchema = (targetSchema && this.isSchemaAllowed(targetSchema)) ? targetSchema : this.config.schema;
    const sql = `SELECT TABLE_NAME, TABLE_TYPE, COMMENTS FROM SYS.TABLES WHERE SCHEMA_NAME = '${effectiveSchema}' ORDER BY TABLE_NAME`;
    return this.executeQuery(sql, effectiveSchema);
  }

  async listViews(targetSchema?: string): Promise<HanaQueryResult> {
    const effectiveSchema = (targetSchema && this.isSchemaAllowed(targetSchema)) ? targetSchema : this.config.schema;
    const sql = `SELECT VIEW_NAME, COMMENTS FROM SYS.VIEWS WHERE SCHEMA_NAME = '${effectiveSchema}' ORDER BY VIEW_NAME`;
    return this.executeQuery(sql, effectiveSchema);
  }

  async dropObject(type: 'TABLE' | 'VIEW', name: string, targetSchema?: string): Promise<HanaQueryResult> {
    const effectiveSchema = (targetSchema && this.isSchemaAllowed(targetSchema)) ? targetSchema : this.config.schema;
    const safeName = name.replace(/[^A-Za-z0-9_#]/g, '');
    const sql = `DROP ${type} "${effectiveSchema}"."${safeName}"`;
    return this.executeQuery(sql, effectiveSchema);
  }

  disconnect(): void {
    if (this.client) {
      try {
        this.client.disconnect();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }
}
