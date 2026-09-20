/**
 * BW Transformation to SQL & CSN Converter
 * Enterprise-grade converter supporting standard SAP tables, custom tables (Z*, Y*, ZZ*, X*),
 * multi-tier Common Table Expressions (CTEs), deduplication windowing, and SAP CSN generation.
 */
import type { ParsedBWTransformation } from '../parser.js';
import type { ConversionResult } from '../index.js';

export interface BWConverterOptions {
  sourceTable?: string;
  lookupTables?: Array<{ table: string; joinKeys: string[]; selectFields: string[] }>;
  isCube?: boolean;
}

export class BWConverter {
  convert(
    transformation: ParsedBWTransformation,
    targetName: string,
    spaceId: string,
    options?: BWConverterOptions
  ): ConversionResult {
    const sourceTable = options?.sourceTable || this.detectSourceTable(transformation);
    const sql = this.generateSQL(transformation, targetName, sourceTable, options);
    const jsonDef = this.generateCSN(transformation, targetName, spaceId, sourceTable, options);
    const cliCmd = this.generateCLICommand(targetName, spaceId);

    return {
      sql,
      jsonDefinition: jsonDef,
      cliCommand: cliCmd,
      warnings: this.checkWarnings(transformation, sourceTable),
      metadata: {
        sourceTables: [sourceTable, ...(options?.lookupTables?.map(l => l.table) || [])],
        outputFields: transformation.targetFields.map(f => f.name.toUpperCase()),
        complexity: this.estimateComplexity(transformation),
        viewName: targetName,
        spaceId,
      },
    };
  }

  private detectSourceTable(transformation: ParsedBWTransformation): string {
    // If transformation specifies a known standard or custom table, extract it
    const nameUpper = transformation.name.toUpperCase();
    if (nameUpper.startsWith('TR_') || nameUpper.startsWith('T_')) {
      const parts = nameUpper.split('_');
      if (parts.length >= 2 && parts[1]) return parts[1];
    }
    // Check if source fields mention table qualification
    for (const f of transformation.sourceFields) {
      if (f.name.includes('.')) {
        return f.name.split('.')[0].toUpperCase();
      }
    }
    // Default fallback
    return 'SOURCE_DATA';
  }

  private mapToCdsType(fieldName: string, formula?: string): { type: string; length?: number; precision?: number; scale?: number } {
    const upper = fieldName.toUpperCase();
    if (formula && (formula.includes('*') || formula.includes('/') || formula.includes('SUM') || formula.includes('AVG') || formula.includes('DECIMAL'))) {
      return { type: 'cds.Decimal', precision: 17, scale: 2 };
    }
    if (upper.endsWith('_DATE') || upper.endsWith('DAT') || upper === 'ERDAT' || upper === 'AEDAT' || upper === 'BUDAT') {
      return { type: 'cds.Date' };
    }
    if (upper.endsWith('_TIME') || upper.endsWith('UZEIT')) {
      return { type: 'cds.Time' };
    }
    if (upper.endsWith('_AMT') || upper.endsWith('_PRICE') || upper.endsWith('NETWR') || upper.endsWith('NETPR') || upper.endsWith('DMBTR') || upper.endsWith('WRBTR')) {
      return { type: 'cds.Decimal', precision: 15, scale: 2 };
    }
    if (upper.endsWith('_QTY') || upper.endsWith('MENGE') || upper.endsWith('KWMENG')) {
      return { type: 'cds.Decimal', precision: 13, scale: 3 };
    }
    if (upper.endsWith('_FLAG') || upper.startsWith('IS_')) {
      return { type: 'cds.Boolean' };
    }
    if (upper === 'MANDT') return { type: 'cds.String', length: 3 };
    if (upper === 'BUKRS' || upper === 'GJAHR') return { type: 'cds.String', length: 4 };
    if (upper === 'VBELN' || upper === 'EBELN' || upper === 'KUNNR' || upper === 'LIFNR' || upper === 'MATNR') return { type: 'cds.String', length: 10 };
    if (upper === 'POSNR' || upper === 'EBELP') return { type: 'cds.String', length: 6 };
    if (upper === 'WAERK' || upper === 'WAERS' || upper === 'CURRENCY') return { type: 'cds.String', length: 5 };
    if (upper === 'MEINS' || upper === 'UNIT') return { type: 'cds.String', length: 3 };

    return { type: 'cds.String', length: 100 };
  }

  private generateSQL(
    transformation: ParsedBWTransformation,
    targetName: string,
    sourceTable: string,
    options?: BWConverterOptions
  ): string {
    const hasFormulas = transformation.targetFields.some(f => f.formula);
    const hasLookups = (options?.lookupTables && options.lookupTables.length > 0);

    // If simple 1:1 mapping with no formulas or lookups, generate simple SELECT
    if (!hasFormulas && !hasLookups) {
      const selectParts = transformation.targetFields.length > 0
        ? transformation.targetFields.map(f => `  "${f.name.toUpperCase()}"`)
        : ['  *'];

      return [
        `CREATE VIEW "${targetName}" AS`,
        'SELECT',
        selectParts.join(',\n'),
        `FROM "${sourceTable}";`,
      ].join('\n');
    }

    // Advanced Multi-Stage CTE generation for high-accuracy production conversion
    const lines: string[] = [`CREATE VIEW "${targetName}" AS`];
    const ctes: string[] = [];

    // Stage 1: Base projection
    ctes.push([
      'base_source AS (',
      '    SELECT',
      '        *',
      `    FROM "${sourceTable}"`,
      ')',
    ].join('\n'));

    // Stage 2: Deduplicated Lookups (if any lookup tables are specified)
    if (options?.lookupTables) {
      options.lookupTables.forEach((lkp, idx) => {
        const partitionCols = lkp.joinKeys.map(k => `"${k.toUpperCase()}"`).join(', ');
        ctes.push([
          `dedup_lookup_${idx + 1} AS (`,
          '    -- Auto-Deduplication: Prevents 1:N Cartesian explosion on custom lookups',
          '    SELECT',
          `        *,`,
          `        ROW_NUMBER() OVER (PARTITION BY ${partitionCols} ORDER BY 1) AS _lookup_rn`,
          `    FROM "${lkp.table.toUpperCase()}"`,
          ')',
        ].join('\n'));
      });
    }

    // Stage 3: Field transformations and formulas
    const finalSelects: string[] = [];
    for (const target of transformation.targetFields) {
      const colName = target.name.toUpperCase();
      if (target.formula) {
        finalSelects.push(`    ${target.formula} AS "${colName}"`);
      } else {
        finalSelects.push(`    src."${colName}"`);
      }
    }

    if (finalSelects.length === 0) {
      finalSelects.push('    src.*');
    }

    lines.push(`WITH ${ctes.join(',\n\n')}`);
    lines.push('SELECT');
    lines.push(finalSelects.join(',\n'));
    lines.push('FROM base_source AS src');

    // Attach lookups safely
    if (options?.lookupTables) {
      options.lookupTables.forEach((lkp, idx) => {
        const joinConditions = lkp.joinKeys.map(k => `src."${k.toUpperCase()}" = lkp${idx + 1}."${k.toUpperCase()}"`).join(' AND ');
        lines.push(`LEFT OUTER JOIN dedup_lookup_${idx + 1} AS lkp${idx + 1}`);
        lines.push(`    ON ${joinConditions}`);
        lines.push(`   AND lkp${idx + 1}._lookup_rn = 1`);
      });
    }

    return lines.join('\n') + ';';
  }

  private generateCSN(
    transformation: ParsedBWTransformation,
    targetName: string,
    spaceId: string,
    sourceTable: string,
    options?: BWConverterOptions
  ): Record<string, unknown> {
    const isCube = options?.isCube ?? true;
    const elements: Record<string, unknown> = {};

    for (const target of transformation.targetFields) {
      const colName = target.name.toUpperCase();
      const typeInfo = this.mapToCdsType(colName, target.formula);
      const elemDef: Record<string, unknown> = {
        type: typeInfo.type,
        ...(typeInfo.length ? { length: typeInfo.length } : {}),
        ...(typeInfo.precision ? { precision: typeInfo.precision } : {}),
        ...(typeInfo.scale ? { scale: typeInfo.scale } : {}),
        '@EndUserText.label': target.name,
      };

      if (typeInfo.type === 'cds.Decimal') {
        elemDef['@DefaultAggregation'] = { '#': 'SUM' };
      }

      elements[colName] = elemDef;
    }

    return {
      definitions: {
        [targetName]: {
          kind: 'entity',
          '@EndUserText.label': `Converted from BW: ${transformation.name}`,
          '@ObjectModel.modelingPattern': { '#': isCube ? 'FACT' : 'DIMENSION' },
          '@ObjectModel.supportedCapabilities': isCube
            ? [{ '#': 'FACT' }, { '#': 'DATA_STRUCTURE' }]
            : [{ '#': 'DIMENSION' }, { '#': 'SQL_DATA_ACCESS' }],
          ...(isCube ? { '@Analytics.dataCategory': { '#': 'CUBE' } } : {}),
          elements,
        },
      },
    };
  }

  private generateCLICommand(targetName: string, spaceId: string): string {
    // Exact syntax accepted by @sap/datasphere-cli (uses -y for space, -F for file)
    return `datasphere objects views create -y "${spaceId}" -F "${targetName}.json"`;
  }

  private checkWarnings(transformation: ParsedBWTransformation, sourceTable: string): string[] {
    const warnings: string[] = [];
    if (transformation.targetFields.length === 0) {
      warnings.push('No target fields defined - default projection used');
    }
    if (sourceTable.startsWith('Z') || sourceTable.startsWith('Y') || sourceTable.startsWith('ZZ')) {
      warnings.push(`Custom table '${sourceTable}' detected: verify table deployment in target space before activation`);
    }
    for (const field of transformation.targetFields) {
      if (field.formula) {
        warnings.push(`Calculation detected for '${field.name}': verify SQL syntax against HANA Cloud`);
      }
    }
    return warnings;
  }

  private estimateComplexity(transformation: ParsedBWTransformation): string {
    const formulas = transformation.targetFields.filter(f => f.formula).length;
    if (formulas === 0) return 'low';
    if (formulas <= 3) return 'medium';
    return 'high';
  }
}
