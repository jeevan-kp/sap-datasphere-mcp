/**
 * ABAP Parser - Parses ABAP source code into structured data
 */
import { ABAPLexer } from './lexer.js';
import type { ABAPFileType, ABAPField, ABAPJoin, ABAPAnalysis } from './index.js';

export interface ParsedCDSView {
  name: string;
  sourceTables: string[];
  fields: ABAPField[];
  joins: ABAPJoin[];
  whereClause: string;
  groupBy: string[];
  having: string;
  annotations: string[];
}

export interface ParsedSelectStatement {
  fields: string[];
  fromTable: string;
  joins: ABAPJoin[];
  whereClause: string;
  groupBy: string[];
  orderBy: string[];
  limit?: number;
}

export interface ParsedBWTransformation {
  name: string;
  sourceFields: Array<{ name: string; formula?: string }>;
  targetFields: Array<{ name: string; formula?: string }>;
}

export interface ParsedFunctionModule {
  name: string;
  parameters: string[];
  selectStatements: ParsedSelectStatement[];
}

export interface ParseResult {
  fileType: ABAPFileType;
  cdsView?: ParsedCDSView;
  selectStatements: ParsedSelectStatement[];
  bwTransformation?: ParsedBWTransformation;
  functionModule?: ParsedFunctionModule;
  warnings: string[];
}

export class ABAPParser {
  private lexer = new ABAPLexer();

  detectFileType(content: string): ABAPFileType {
    const upper = content.toUpperCase().trim();

    if (upper.includes('DEFINE VIEW') || upper.includes('DEFINE VIEW ENTITY')) {
      return 'CDS_VIEW';
    }
    if (upper.includes('@ENDUSERTEXT') || upper.includes('@ACCESSCONTROL')) {
      return 'CDS_VIEW';
    }
    if (upper.includes('REPORT ') || upper.includes('START-OF-SELECTION')) {
      return 'ABAP_REPORT';
    }
    if (upper.includes('BEGIN OF TRANSFORMATION') || upper.includes('END OF TRANSFORMATION')) {
      return 'BW_TRANSFORMATION';
    }
    if (upper.includes('FUNCTION ') && upper.includes('ENDFUNCTION')) {
      return 'FUNCTION_MODULE';
    }
    if (upper.includes('SELECT ') && upper.includes('FROM ')) {
      return 'ABAP_REPORT';
    }

    return 'UNKNOWN';
  }

  parse(content: string): ParseResult {
    const fileType = this.detectFileType(content);

    switch (fileType) {
      case 'CDS_VIEW':
        return this.parseCDSView(content);
      case 'ABAP_REPORT':
        return this.parseReport(content);
      case 'BW_TRANSFORMATION':
        return this.parseBWTransformation(content);
      case 'FUNCTION_MODULE':
        return this.parseFunctionModule(content);
      default:
        return { fileType: 'UNKNOWN', selectStatements: [], warnings: ['Could not determine file type'] };
    }
  }

  private parseCDSView(content: string): ParseResult {
    const view: ParsedCDSView = {
      name: '',
      sourceTables: [],
      fields: [],
      joins: [],
      whereClause: '',
      groupBy: [],
      having: '',
      annotations: [],
    };

    const lines = content.split('\n');
    let inBody = false;
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      const upper = trimmed.toUpperCase();

      // Collect annotations
      if (trimmed.startsWith('@') || trimmed.startsWith('//@')) {
        view.annotations.push(trimmed);
        continue;
      }

      // Match DEFINE VIEW ... AS SELECT FROM
      const defineMatch = trimmed.match(
        /DEFINE\s+(?:VIEW\s+ENTITY\s+)?(\w+)\s+AS\s+SELECT\s+(?:FROM\s+)?(\w+)/i
      );
      if (defineMatch) {
        view.name = defineMatch[1];
        view.sourceTables.push(defineMatch[2]);
        inBody = true;
        continue;
      }

      // Match standalone FROM
      if (!inBody && upper.startsWith('FROM ')) {
        const fromMatch = trimmed.match(/FROM\s+(\w+)/i);
        if (fromMatch) {
          view.sourceTables.push(fromMatch[1]);
        }
        continue;
      }

      // Match LEFT JOIN
      const leftJoinMatch = trimmed.match(
        /LEFT\s+(?:OUTER\s+)?JOIN\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+(.+)/i
      );
      if (leftJoinMatch) {
        view.joins.push({
          type: 'LEFT',
          table: leftJoinMatch[1],
          alias: leftJoinMatch[2],
          condition: leftJoinMatch[3].trim(),
        });
        continue;
      }

      // Match INNER JOIN
      const innerJoinMatch = trimmed.match(
        /INNER\s+JOIN\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+(.+)/i
      );
      if (innerJoinMatch) {
        view.joins.push({
          type: 'INNER',
          table: innerJoinMatch[1],
          alias: innerJoinMatch[2],
          condition: innerJoinMatch[3].trim(),
        });
        continue;
      }

      // Match RIGHT JOIN
      const rightJoinMatch = trimmed.match(
        /RIGHT\s+(?:OUTER\s+)?JOIN\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+(.+)/i
      );
      if (rightJoinMatch) {
        view.joins.push({
          type: 'RIGHT',
          table: rightJoinMatch[1],
          alias: rightJoinMatch[2],
          condition: rightJoinMatch[3].trim(),
        });
        continue;
      }

      // Match WHERE
      if (upper.startsWith('WHERE ')) {
        view.whereClause = trimmed.substring(6).trim();
        continue;
      }

      // Match GROUP BY
      if (upper.startsWith('GROUP BY')) {
        view.groupBy = trimmed.substring(8).split(',').map(g => g.trim());
        continue;
      }

      // Match HAVING
      if (upper.startsWith('HAVING')) {
        view.having = trimmed.substring(6).trim();
        continue;
      }

      // Parse fields inside braces
      if (trimmed === '{') {
        inBody = true;
        braceDepth++;
        continue;
      }
      if (trimmed === '}') {
        braceDepth--;
        if (braceDepth <= 0) {
          inBody = false;
        }
        continue;
      }

      if (inBody && trimmed && !trimmed.startsWith('//')) {
        const field = this.parseCDSField(trimmed);
        if (field) {
          view.fields.push(field);
        }
      }
    }

    return {
      fileType: 'CDS_VIEW',
      cdsView: view,
      selectStatements: [],
      warnings: this.validateCDSView(view),
    };
  }

  private parseCDSField(line: string): ABAPField | null {
    // Match: key field_name as alias
    // Match: field_name as alias
    // Match: field_name
    const keyMatch = line.match(/key\s+(\w+(?:\.\w+)?)\s+(?:as\s+)?(\w+)/i);
    if (keyMatch) {
      return { name: keyMatch[1], alias: keyMatch[2], isKey: true };
    }

    const fieldMatch = line.match(/(\w+(?:\.\w+)?)\s+(?:as\s+)?(\w+)/i);
    if (fieldMatch) {
      return { name: fieldMatch[1], alias: fieldMatch[2], isKey: false };
    }

    const simpleMatch = line.match(/^(\w+(?:\.\w+)?)$/);
    if (simpleMatch) {
      return { name: simpleMatch[1], isKey: false };
    }

    return null;
  }

  private parseReport(content: string): ParseResult {
    const cleaned = this.lexer.removeComments(content);
    const selectStatements: ParsedSelectStatement[] = [];

    // Match SELECT statements
    const selectRegex = /SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+(?:INNER|LEFT|RIGHT)\s+(?:OUTER\s+)?JOIN\s+(\w+)\s+ON\s+(.+?))?(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+UP\s+TO\s+(\d+)\s+ROWS)?/gi;

    let match;
    while ((match = selectRegex.exec(cleaned)) !== null) {
      const fields = match[1].split(',').map(f => f.trim());
      const stmt: ParsedSelectStatement = {
        fields,
        fromTable: match[2],
        joins: [],
        whereClause: match[5] || '',
        groupBy: match[6] ? match[6].split(',').map(g => g.trim()) : [],
        orderBy: match[7] ? match[7].split(',').map(o => o.trim()) : [],
        limit: match[8] ? parseInt(match[8]) : undefined,
      };

      if (match[3] && match[4]) {
        stmt.joins.push({
          type: 'INNER',
          table: match[3],
          condition: match[4].trim(),
        });
      }

      selectStatements.push(stmt);
    }

    // Extract report name
    let reportName = '';
    const nameMatch = cleaned.match(/REPORT\s+(\w+)/i);
    if (nameMatch) {
      reportName = nameMatch[1];
    }

    return {
      fileType: 'ABAP_REPORT',
      selectStatements,
      warnings: selectStatements.length === 0 ? ['No SELECT statements found'] : [],
    };
  }

  private parseBWTransformation(content: string): ParseResult {
    const transformation: ParsedBWTransformation = {
      name: '',
      sourceFields: [],
      targetFields: [],
    };

    // Extract transformation name
    const nameMatch = content.match(/(?:BEGIN\s+OF\s+)?TRANSFORMATION\s+(\w+)/i);
    if (nameMatch) {
      transformation.name = nameMatch[1];
    }

    // Match rules: SOURCE -> TARGET (formula)
    const ruleRegex = /(\w+)\s*->\s*(\w+)(?:\s*\((.+?)\))?/gi;
    let match;
    while ((match = ruleRegex.exec(content)) !== null) {
      transformation.sourceFields.push({ name: match[1] });
      transformation.targetFields.push({
        name: match[2],
        formula: match[3],
      });
    }

    // Extract SOURCE FIELDS and TARGET FIELDS sections
    const sourceFieldsMatch = content.match(/SOURCE\s+FIELDS:\s*(.+?)\s*TARGET/is);
    if (sourceFieldsMatch) {
      const fields = sourceFieldsMatch[1].split('\n')
        .map(f => f.trim())
        .filter(f => f && !f.startsWith('TARGET'));
      for (const field of fields) {
        const name = field.replace(/[,;]/g, '').trim();
        if (name && !transformation.sourceFields.find(s => s.name === name)) {
          transformation.sourceFields.push({ name });
        }
      }
    }

    return {
      fileType: 'BW_TRANSFORMATION',
      bwTransformation: transformation,
      selectStatements: [],
      warnings: transformation.targetFields.length === 0 ? ['No target fields found'] : [],
    };
  }

  private parseFunctionModule(content: string): ParseResult {
    const fm: ParsedFunctionModule = {
      name: '',
      parameters: [],
      selectStatements: [],
    };

    // Extract function name
    const nameMatch = content.match(/FUNCTION\s+(\w+)/i);
    if (nameMatch) {
      fm.name = nameMatch[1];
    }

    // Extract parameters
    const paramRegex = /(?:USING|CHANGING|TABLES|IMPORTING|EXPORTING)\s+(\w+)/gi;
    let match;
    while ((match = paramRegex.exec(content)) !== null) {
      fm.parameters.push(match[1]);
    }

    // Reuse report parser for SELECT statements
    const reportResult = this.parseReport(content);
    fm.selectStatements = reportResult.selectStatements;

    return {
      fileType: 'FUNCTION_MODULE',
      functionModule: fm,
      selectStatements: fm.selectStatements,
      warnings: fm.selectStatements.length === 0 ? ['No SELECT statements found in function module'] : [],
    };
  }

  private validateCDSView(view: ParsedCDSView): string[] {
    const warnings: string[] = [];

    if (view.fields.length === 0) {
      warnings.push('No fields found in CDS view');
    }
    if (view.sourceTables.length === 0) {
      warnings.push('No source tables identified');
    }
    if (view.joins.length > 3) {
      warnings.push(`Complex join structure with ${view.joins.length} joins`);
    }

    return warnings;
  }

  analyze(content: string): ABAPAnalysis {
    const result = this.parse(content);
    const analysis: ABAPAnalysis = {
      type: result.fileType,
      name: '',
      sourceTables: [],
      joins: [],
      fields: [],
      filters: [],
      aggregations: [],
      groupBy: [],
      annotations: [],
      complexity: 'low',
      warnings: result.warnings,
    };

    if (result.cdsView) {
      analysis.name = result.cdsView.name;
      analysis.sourceTables = result.cdsView.sourceTables;
      analysis.joins = result.cdsView.joins;
      analysis.fields = result.cdsView.fields;
      analysis.annotations = result.cdsView.annotations;
      if (result.cdsView.whereClause) {
        analysis.filters.push(result.cdsView.whereClause);
      }
      analysis.groupBy = result.cdsView.groupBy;
    } else if (result.selectStatements.length > 0) {
      const tables = new Set<string>();
      const fields: ABAPField[] = [];
      for (const stmt of result.selectStatements) {
        tables.add(stmt.fromTable);
        for (const f of stmt.fields) {
          fields.push({ name: f, isKey: false });
        }
        if (stmt.whereClause) {
          analysis.filters.push(stmt.whereClause);
        }
      }
      analysis.sourceTables = [...tables];
      analysis.fields = fields;
    } else if (result.bwTransformation) {
      analysis.name = result.bwTransformation.name;
      analysis.fields = result.bwTransformation.targetFields.map(f => ({
        name: f.name,
        calculation: f.formula,
        isKey: false,
      }));
    } else if (result.functionModule) {
      analysis.name = result.functionModule.name;
    }

    // Estimate complexity
    analysis.complexity = this.estimateComplexity(analysis);

    return analysis;
  }

  private estimateComplexity(analysis: ABAPAnalysis): 'low' | 'medium' | 'high' {
    let score = 0;
    score += analysis.fields.length * 0.5;
    score += analysis.joins.length * 2;
    score += analysis.filters.length;
    score += analysis.groupBy.length * 1.5;

    if (score <= 5) return 'low';
    if (score <= 15) return 'medium';
    return 'high';
  }
}
