/**
 * Function Module to SQL Converter
 */
import type { ParsedFunctionModule, ParsedSelectStatement } from '../parser.js';
import type { ConversionResult } from '../index.js';

export class FMConverter {
  convert(fm: ParsedFunctionModule, targetName: string, spaceId: string): ConversionResult {
    const sql = this.generateSQL(fm, targetName);
    const jsonDef = this.generateJSON(fm, targetName, spaceId);
    const cliCmd = this.generateCLICommand(targetName, spaceId);

    const tables = [...new Set(fm.selectStatements.map(s => s.fromTable))];
    const fields = [...new Set(fm.selectStatements.flatMap(s => s.fields))];

    return {
      sql,
      jsonDefinition: jsonDef,
      cliCommand: cliCmd,
      warnings: this.checkWarnings(fm),
      metadata: {
        sourceTables: tables,
        outputFields: fields,
        complexity: 'medium',
        viewName: targetName,
        spaceId,
      },
    };
  }

  private generateSQL(fm: ParsedFunctionModule, targetName: string): string {
    if (fm.selectStatements.length === 0) {
      return `-- No SELECT statements found in function module ${fm.name}\n-- Manual conversion may be required`;
    }

    const stmt = fm.selectStatements[0];
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

    return lines.join('\n') + ';';
  }

  private generateJSON(fm: ParsedFunctionModule, targetName: string, spaceId: string): Record<string, unknown> {
    const fields = [...new Set(fm.selectStatements.flatMap(s => s.fields))];

    return {
      technicalName: targetName,
      description: `Converted from function module: ${fm.name}`,
      spaceId,
      columns: fields.map(f => ({
        name: f.toUpperCase(),
        technicalName: f.toUpperCase(),
        dataType: 'NVARCHAR',
      })),
      sqlDefinition: this.generateSQL(fm, targetName),
    };
  }

  private generateCLICommand(targetName: string, spaceId: string): string {
    return `datasphere objects views create --space "${spaceId}" --technical-name "${targetName}" --file-path "${targetName}.json"`;
  }

  private checkWarnings(fm: ParsedFunctionModule): string[] {
    const warnings: string[] = [];
    if (fm.selectStatements.length === 0) {
      warnings.push('Function module contains no SELECT statements');
    }
    if (fm.selectStatements.length > 1) {
      warnings.push(`${fm.selectStatements.length} SELECT statements found - using first for view`);
    }
    return warnings;
  }
}
