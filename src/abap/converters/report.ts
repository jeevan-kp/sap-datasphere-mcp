/**
 * ABAP Report to SQL Converter
 */
import type { ParsedSelectStatement } from '../parser.js';
import type { ConversionResult } from '../index.js';

export class ReportConverter {
  convert(statements: ParsedSelectStatement[], targetName: string, spaceId: string): ConversionResult {
    const sql = this.generateSQL(statements, targetName);
    const jsonDef = this.generateJSON(statements, targetName, spaceId);
    const cliCmd = this.generateCLICommand(targetName, spaceId);

    const tables = [...new Set(statements.map(s => s.fromTable))];
    const fields = [...new Set(statements.flatMap(s => s.fields))];

    return {
      sql,
      jsonDefinition: jsonDef,
      cliCommand: cliCmd,
      warnings: this.checkWarnings(statements),
      metadata: {
        sourceTables: tables,
        outputFields: fields,
        complexity: this.estimateComplexity(statements),
        viewName: targetName,
        spaceId,
      },
    };
  }

  private generateSQL(statements: ParsedSelectStatement[], targetName: string): string {
    if (statements.length === 0) {
      return '-- No SELECT statements found';
    }

    if (statements.length === 1) {
      return this.singleSelectToSQL(statements[0], targetName);
    }

    return this.multiSelectToSQL(statements, targetName);
  }

  private singleSelectToSQL(stmt: ParsedSelectStatement, targetName: string): string {
    const lines: string[] = [`CREATE VIEW "${targetName}" AS`];

    const fields = stmt.fields.length > 0
      ? stmt.fields.map(f => `"${f.toUpperCase()}"`).join(', ')
      : '*';
    lines.push(`SELECT ${fields}`);
    lines.push(`FROM "${stmt.fromTable.toUpperCase()}"`);

    for (const join of stmt.joins) {
      lines.push(`${join.type} JOIN "${join.table.toUpperCase()}"`);
      lines.push(`  ON ${join.condition}`);
    }

    if (stmt.whereClause) {
      lines.push(`WHERE ${stmt.whereClause}`);
    }

    if (stmt.groupBy.length > 0) {
      lines.push(`GROUP BY ${stmt.groupBy.join(', ')}`);
    }

    if (stmt.orderBy.length > 0) {
      lines.push(`ORDER BY ${stmt.orderBy.join(', ')}`);
    }

    if (stmt.limit) {
      lines.push(`LIMIT ${stmt.limit}`);
    }

    return lines.join('\n') + ';';
  }

  private multiSelectToSQL(statements: ParsedSelectStatement[], targetName: string): string {
    const parts = statements.map(stmt => {
      const fields = stmt.fields.map(f => `"${f.toUpperCase()}"`).join(', ');
      let part = `SELECT ${fields} FROM "${stmt.fromTable.toUpperCase()}"`;
      if (stmt.whereClause) {
        part += ` WHERE ${stmt.whereClause}`;
      }
      return part;
    });

    const unionSQL = parts.join('\nUNION ALL\n');
    return `CREATE VIEW "${targetName}" AS\n${unionSQL};`;
  }

  private generateJSON(statements: ParsedSelectStatement[], targetName: string, spaceId: string): Record<string, unknown> {
    const tables = [...new Set(statements.map(s => s.fromTable))];
    const fields = [...new Set(statements.flatMap(s => s.fields))];

    return {
      technicalName: targetName,
      description: 'Converted from ABAP report',
      spaceId,
      columns: fields.map(f => ({
        name: f.toUpperCase(),
        technicalName: f.toUpperCase(),
        dataType: 'NVARCHAR',
      })),
      sqlDefinition: this.generateSQL(statements, targetName),
    };
  }

  private generateCLICommand(targetName: string, spaceId: string): string {
    return `datasphere objects views create --space "${spaceId}" --technical-name "${targetName}" --file-path "${targetName}.json"`;
  }

  private checkWarnings(statements: ParsedSelectStatement[]): string[] {
    const warnings: string[] = [];
    if (statements.length > 1) {
      warnings.push(`${statements.length} SELECT statements found - using first for view`);
    }
    for (const stmt of statements) {
      if (stmt.limit) {
        warnings.push(`LIMIT ${stmt.limit} detected - view will include all matching rows`);
      }
    }
    return warnings;
  }

  private estimateComplexity(statements: ParsedSelectStatement[]): string {
    const totalFields = statements.reduce((sum, s) => sum + s.fields.length, 0);
    const totalJoins = statements.reduce((sum, s) => sum + s.joins.length, 0);
    if (totalFields <= 10 && totalJoins <= 1) return 'low';
    if (totalFields <= 20 && totalJoins <= 3) return 'medium';
    return 'high';
  }
}
