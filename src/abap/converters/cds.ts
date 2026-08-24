/**
 * CDS View to SQL Converter
 */
import type { ParsedCDSView } from '../parser.js';
import type { ConversionResult } from '../index.js';

export class CDSConverter {
  convert(view: ParsedCDSView, targetName: string, spaceId: string): ConversionResult {
    const sql = this.generateSQL(view, targetName);
    const jsonDef = this.generateJSON(view, targetName, spaceId);
    const cliCmd = this.generateCLICommand(targetName, spaceId);

    return {
      sql,
      jsonDefinition: jsonDef,
      cliCommand: cliCmd,
      warnings: this.checkWarnings(view),
      metadata: {
        sourceTables: view.sourceTables,
        outputFields: view.fields.map(f => f.alias || f.name),
        complexity: this.estimateComplexity(view),
        viewName: targetName,
        spaceId,
      },
    };
  }

  private generateSQL(view: ParsedCDSView, targetName: string): string {
    const lines: string[] = [`CREATE VIEW "${targetName}" AS`];

    // Build SELECT fields
    const selectParts: string[] = [];
    for (let i = 0; i < view.fields.length; i++) {
      const field = view.fields[i];
      let col = `  T0."${field.name.toUpperCase()}"`;
      if (field.alias) {
        col += ` AS "${field.alias.toUpperCase()}"`;
      }
      selectParts.push(col);
    }

    if (selectParts.length === 0) {
      selectParts.push('  *');
    }

    lines.push('SELECT');
    lines.push(selectParts.join(',\n'));

    // FROM clause
    if (view.sourceTables.length > 0) {
      lines.push(`FROM "${view.sourceTables[0].toUpperCase()}" T0`);
    }

    // JOINs
    for (let i = 0; i < view.joins.length; i++) {
      const join = view.joins[i];
      const alias = join.alias || `T${i + 1}`;
      lines.push(`${join.type} JOIN "${join.table.toUpperCase()}" ${alias}`);
      lines.push(`  ON ${join.condition}`);
    }

    // WHERE
    if (view.whereClause) {
      lines.push(`WHERE ${view.whereClause}`);
    }

    // GROUP BY
    if (view.groupBy.length > 0) {
      lines.push(`GROUP BY ${view.groupBy.join(', ')}`);
    }

    // HAVING
    if (view.having) {
      lines.push(`HAVING ${view.having}`);
    }

    return lines.join('\n') + ';';
  }

  private generateJSON(view: ParsedCDSView, targetName: string, spaceId: string): Record<string, unknown> {
    return {
      technicalName: targetName,
      description: `Converted from CDS view: ${view.name}`,
      spaceId,
      columns: view.fields.map(f => ({
        name: f.alias || f.name,
        technicalName: f.name.toUpperCase(),
        dataType: f.dataType || 'NVARCHAR',
        isKey: f.isKey,
      })),
      sqlDefinition: this.generateSQL(view, targetName),
    };
  }

  private generateCLICommand(targetName: string, spaceId: string): string {
    return `datasphere objects views create --space "${spaceId}" --technical-name "${targetName}" --file-path "${targetName}.json"`;
  }

  private checkWarnings(view: ParsedCDSView): string[] {
    const warnings: string[] = [];
    if (view.fields.length === 0) warnings.push('No fields found - using SELECT *');
    if (view.sourceTables.length === 0) warnings.push('No source tables identified');
    if (view.joins.length > 3) warnings.push(`Complex join structure with ${view.joins.length} joins`);
    return warnings;
  }

  private estimateComplexity(view: ParsedCDSView): string {
    let score = 0;
    score += view.fields.length * 0.5;
    score += view.joins.length * 2;
    score += view.whereClause ? 1 : 0;
    score += view.groupBy.length * 1.5;
    if (score <= 5) return 'low';
    if (score <= 15) return 'medium';
    return 'high';
  }
}
