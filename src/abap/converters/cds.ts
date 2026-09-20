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
    const elements: Record<string, unknown> = {};

    for (const f of view.fields) {
      const colName = (f.alias || f.name).toUpperCase();
      let cdsType = 'cds.String';
      const dt = (f.dataType || '').toUpperCase();
      if (dt.includes('INT')) cdsType = 'cds.Integer';
      else if (dt.includes('DEC') || dt.includes('CURR') || dt.includes('QUAN')) cdsType = 'cds.Decimal';
      else if (dt.includes('DAT')) cdsType = 'cds.Date';
      else if (dt.includes('TIM')) cdsType = 'cds.Time';
      else if (dt.includes('BOOL')) cdsType = 'cds.Boolean';

      elements[colName] = {
        type: cdsType,
        ...(f.isKey ? { key: true, notNull: true } : {}),
        '@EndUserText.label': f.alias || f.name,
      };
    }

    return {
      definitions: {
        [targetName]: {
          kind: 'entity',
          '@EndUserText.label': `Converted from CDS View: ${view.name}`,
          '@ObjectModel.modelingPattern': { '#': 'FACT' },
          '@ObjectModel.supportedCapabilities': [{ '#': 'FACT' }, { '#': 'DATA_STRUCTURE' }],
          '@Analytics.dataCategory': { '#': 'CUBE' },
          elements,
        },
      },
    };
  }

  private generateCLICommand(targetName: string, spaceId: string): string {
    return `datasphere objects views create -y "${spaceId}" -F "${targetName}.json"`;
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
