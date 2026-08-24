/**
 * ABAP Lexer - Tokenizes ABAP source code in TypeScript
 */

export enum TokenType {
  KEYWORD = 'KEYWORD',
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  OPERATOR = 'OPERATOR',
  PUNCTUATION = 'PUNCTUATION',
  COMMENT = 'COMMENT',
  ANNOTATION = 'ANNOTATION',
  WHITESPACE = 'WHITESPACE',
  NEWLINE = 'NEWLINE',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const ABAP_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'AS', 'GROUP', 'BY', 'ORDER', 'HAVING', 'UNION', 'ALL',
  'INTO', 'VALUES', 'SET', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'IF', 'ELSEIF', 'LOOP', 'ENDLOOP', 'EXIT', 'CONTINUE', 'RETURN',
  'PERFORM', 'USING', 'CHANGING', 'TABLES', 'DATA', 'TYPES',
  'DEFINE', 'KEY', 'ELEMENT', 'ASSOCIATION', 'TO', 'WITH', 'DEFAULT',
  'VALUE', 'FUNCTION', 'MODULE', 'FORM', 'REPORT', 'ENTITY',
  'VIEW', 'SELECTIVE', 'COMPOSITION', 'PROJECTION', 'FILTER', 'CONDITION',
  'ANNOTATION', 'SOURCE', 'TARGET', 'RULE', 'BEGIN', 'OF',
]);

const CDS_ANNOTATIONS = /@\w+(?:\.\w+)*/;

export class ABAPLexer {
  private patterns: Array<{ type: TokenType; regex: RegExp }> = [
    { type: TokenType.COMMENT, regex: /"[^"]*"|^\*.*/gm },
    { type: TokenType.ANNOTATION, regex: /@\w+(?:\.\w+)*/g },
    { type: TokenType.STRING, regex: /'[^']*'|"[^"]*"/g },
    { type: TokenType.NUMBER, regex: /\b\d+(?:\.\d+)?\b/g },
    { type: TokenType.KEYWORD, regex: /\b[A-Z][A-Z0-9_\-]*\b/g },
    { type: TokenType.IDENTIFIER, regex: /\b[A-Za-z_]\w*\b/g },
    { type: TokenType.OPERATOR, regex: /[<>=!<>]+|=>|\+=|-=|\*=|=/g },
    { type: TokenType.PUNCTUATION, regex: /[.,;:()\[\]{}]|->/g },
  ];

  tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    const lines = source.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      let col = 0;

      // Remove ABAP comments (everything after " on a line)
      const commentIdx = line.indexOf('"');
      const cleanLine = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

      // Tokenize the clean line
      let remaining = cleanLine;
      while (remaining.length > 0) {
        let matched = false;

        for (const pattern of this.patterns) {
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(remaining);

          if (match && match.index === 0) {
            const value = match[0];

            // Skip whitespace
            if (pattern.type === TokenType.WHITESPACE) {
              col += value.length;
              remaining = remaining.substring(value.length);
              matched = true;
              break;
            }

            // Classify keywords
            let finalType = pattern.type;
            if (pattern.type === TokenType.KEYWORD || pattern.type === TokenType.IDENTIFIER) {
              const upper = value.toUpperCase();
              if (ABAP_KEYWORDS.has(upper)) {
                finalType = TokenType.KEYWORD;
              } else {
                finalType = TokenType.IDENTIFIER;
              }
            }

            tokens.push({
              type: finalType,
              value,
              line: lineNum + 1,
              column: col,
            });

            col += value.length;
            remaining = remaining.substring(value.length);
            matched = true;
            break;
          }
        }

        if (!matched) {
          col++;
          remaining = remaining.substring(1);
        }
      }
    }

    return tokens;
  }

  removeComments(source: string): string {
    return source
      .split('\n')
      .map(line => {
        const idx = line.indexOf('"');
        return idx >= 0 ? line.substring(0, idx) : line;
      })
      .join('\n')
      .trim();
  }
}
