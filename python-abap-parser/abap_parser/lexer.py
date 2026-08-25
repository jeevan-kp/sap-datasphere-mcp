"""ABAP Lexer - Tokenizes ABAP source code"""
import re
from enum import Enum
from dataclasses import dataclass


class TokenType(Enum):
    KEYWORD = 'KEYWORD'
    IDENTIFIER = 'IDENTIFIER'
    STRING = 'STRING'
    NUMBER = 'NUMBER'
    OPERATOR = 'OPERATOR'
    PUNCTUATION = 'PUNCTUATION'
    COMMENT = 'COMMENT'
    WHITESPACE = 'WHITESPACE'
    NEWLINE = 'NEWLINE'
    ANNOTATION = 'ANNOTATION'


ABAP_KEYWORDS = {
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
    'AS', 'GROUP', 'BY', 'ORDER', 'HAVING', 'UNION', 'ALL', 'INSERT',
    'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'VIEW', 'INTO', 'VALUES',
    'SET', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'ELSEIF',
    'LOOP', 'ENDLOOP', 'EXIT', 'CONTINUE', 'RETURN', 'PERFORM', 'USING',
    'CHANGING', 'TABLES', 'DATA', 'TYPES', 'BEGIN', 'OF', 'ENDOF',
    'DEFINE', 'KEY', 'ELEMENT', 'ASSOCIATION', 'TO', 'INNER', 'LEFT',
    'OUTER', 'JOIN', 'CONDITION', 'WITH', 'DEFAULT', 'VALUE',
    'METHOD', 'CLASS', 'FUNCTION', 'MODULE', 'FORM', 'REPORT',
    'INFOTYPES', 'TABLES', 'RANGES', 'PARAMETERS', 'SELECTION-SCREEN',
    'START-OF-SELECTION', 'END-OF-SELECTION', 'TOP-OF-PAGE',
    'AT', 'FIRST', 'LAST', 'NEW', 'LINE', 'SELECT-OPTIONS',
    'AUTHORITY-CHECK', 'MOVE', 'CORRESPONDING', 'APPEND', 'CLEAR',
    'FREE', 'REFRESH', 'SORT', 'COLLECT', 'READ', 'TABLE',
    'MODIFY', 'DELETE', 'INSERT', 'DESCRIBE', 'WRITE', 'ULINE',
    'SKIP', 'POSITION', 'FORMAT', 'INPUT', 'OUTPUT',
}

CDS_KEYWORDS = {
    'DEFINE', 'VIEW', 'ENTITY', 'SELECT', 'FROM', 'AS', 'KEY',
    'ELEMENT', 'ASSOCIATION', 'COMPOSITION', 'PROJECTION', 'SELECTIVE',
    'WHERE', 'GROUP', 'BY', 'HAVING', 'UNION', 'ALL',
    'INNER', 'LEFT', 'RIGHT', 'OUTER', 'JOIN', 'ON',
    'WITH', 'DEFAULT', 'VALUE', 'FILTER', 'CONDITION',
    'ANNOTATION', 'END', 'DEFINE', 'VIEW', 'ENTITY',
}

BW_KEYWORDS = {
    'RULE', 'START', 'END', 'ROUTINE', 'FORM', 'USING',
    'CHANGING', 'RESULT', 'SOURCE', 'TARGET', 'FIELD',
    'CONSTANT', 'VARIABLE', 'CALCULATION', 'FORMULA',
    'AGGREGATE', 'GROUP', 'BY', 'KEY', 'LOOKUP',
    'FILTER', 'SORT', 'MERGE', 'SPLIT', 'CONVERT',
}


@dataclass
class Token:
    type: TokenType
    value: str
    line: int
    column: int


class ABAPLexer:
    """Tokenizes ABAP source code into tokens."""

    PATTERNS = [
        (TokenType.COMMENT, r'(?:".*?"|\*.*)'),
        (TokenType.ANNOTATION, r'@\w+(?:\.\w+)*'),
        (TokenType.STRING, "'[^']*'|" + '"[^"]*"'),
        (TokenType.NUMBER, r'\b\d+(?:\.\d+)?\b'),
        (TokenType.KEYWORD, r'\b[A-Z][A-Z0-9_\-]*\b'),
        (TokenType.IDENTIFIER, r'\b[A-Za-z_]\w*\b'),
        (TokenType.OPERATOR, r'[<>=!<>]+|=>|\+=|-=|\*=|/='),
        (TokenType.PUNCTUATION, r'[.,;:()\[\]{}]|->'),
        (TokenType.WHITESPACE, r'\s+'),
    ]

    def __init__(self):
        self.master_pattern = re.compile(
            '|'.join(f'(?P<{name.value}>{pattern})'
                     for name, pattern in self.PATTERNS),
            re.IGNORECASE
        )

    def tokenize(self, source: str) -> list[Token]:
        tokens = []
        line = 1
        column = 1

        for match in self.master_pattern.finditer(source):
            token_type = None
            for name, _ in self.PATTERNS:
                if match.group(name.value):
                    token_type = name
                    break

            if token_type is None:
                continue

            value = match.group()
            if token_type == TokenType.KEYWORD:
                upper_val = value.upper()
                if upper_val in ABAP_KEYWORDS or upper_val in CDS_KEYWORDS or upper_val in BW_KEYWORDS:
                    token_type = TokenType.KEYWORD
                else:
                    token_type = TokenType.IDENTIFIER

            if token_type == TokenType.WHITESPACE:
                newlines = value.count('\n')
                if newlines > 0:
                    line += newlines
                    column = len(value) - value.rfind('\n')
                else:
                    column += len(value)
                continue

            tokens.append(Token(type=token_type, value=value, line=line, column=column))
            column += len(value)

        return tokens

    def remove_comments(self, source: str) -> str:
        """Remove ABAP comments from source code."""
        source = re.sub(r'"[^"]*"', '', source)
        source = re.sub(r'\*.*$', '', source, flags=re.MULTILINE)
        return source.strip()
