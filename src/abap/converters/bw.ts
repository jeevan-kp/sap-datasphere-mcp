/**
 * BW Transformation to SQL Converter
 */
import type { ParsedBWTransformation } from '../parser.js';
import type { ConversionResult } from '../index.js';

export class BWConverter {
  convert(transformation: ParsedBWTransformation, targetName: string, spaceId: string): ConversionResult {
    const sql = this.generateSQL(transformation, targetName);
    const jsonDef = this.generateJSON(transformation, targetName, spaceId);
    const cliCmd = this.generateCLICommand(targetName, spaceId);

    return {
      sql,
      jsonDefinition: jsonDef,
      cliCommand: cliCmd,
      warnings: this.checkWarnings(transformation),
      metadata: {
        sourceTables: [],
        outputFields: transformation.targetFields.map(f => f.name),
        complexity: this.estimateComplexity(transformation),
        viewName: targetName,
        spaceId,
      },
    };
  }

  private generateSQL(transformation: ParsedBWTransformation, targetName: string): string {
    const lines: string[] = [`CREATE VIEW "${targetName}" AS`];

    const selectParts: string[] = [];
    for (const target of transformation.targetFields) {
      if (target.formula) {
        selectParts.push(`  ${target.formula} AS "${target.name.toUpperCase()}"`);
      } else {
        selectParts.push(`  "${target.name.toUpperCase()}"`);
      }
    }

    if (selectParts.length === 0) {
      selectParts.push('  *');
    }

    lines.push('SELECT');
    lines.push(selectParts.join(',\n'));

    // Use first source field as the source table (simplified)
    if (transformation.sourceFields.length > 0) {
      lines.push(`FROM "${transformation.sourceFields[0].name.toUpperCase()}"`);
    }

    return lines.join('\n') + ';';
  }

  private generateJSON(transformation: ParsedBWTransformation, targetName: string, spaceId: string): Record<string, unknown> {
    return {
      technicalName: targetName,
      description: `Converted from BW transformation: ${transformation.name}`,
      spaceId,
      columns: transformation.targetFields.map(f => ({
        name: f.name,
        technicalName: f.name.toUpperCase(),
        dataType: f.formula ? 'DOUBLE' : 'NVARCHAR',
        isKey: false,
      })),
      sqlDefinition: this.generateSQL(transformation, targetName),
    };
  }

  private generateCLICommand(targetName: string, spaceId: string): string {
    return `datasphere objects views create --space "${spaceId}" --technical-name "${targetName}" --file-path "${targetName}.json"`;
  }

  private checkWarnings(transformation: ParsedBWTransformation): string[] {
    const warnings: string[] = [];
    if (transformation.targetFields.length === 0) {
      warnings.push('No target fields defined');
    }
    for (const field of transformation.targetFields) {
      if (field.formula) {
        warnings.push(`Formula detected for ${field.name}: verify calculation logic`);
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
