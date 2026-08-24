"""ABAP Parser - Parses ABAP source code into AST structures"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from .lexer import ABAPLexer, TokenType, Token


class ABAPFileType(Enum):
    CDS_VIEW = 'CDS_VIEW'
    ABAP_REPORT = 'ABAP_REPORT'
    BW_TRANSFORMATION = 'BW_TRANSFORMATION'
    FUNCTION_MODULE = 'FUNCTION_MODULE'
    UNKNOWN = 'UNKNOWN'


@dataclass
class CDSField:
    name: str
    alias: Optional[str] = None
    is_key: bool = False
    data_type: Optional[str] = None
    annotations: list[str] = field(default_factory=list)


@dataclass
class CDSJoin:
    join_type: str  # INNER, LEFT OUTER, RIGHT OUTER, FULL OUTER, CROSS
    table: str
    alias: Optional[str] = None
    condition: str = ''


@dataclass
class CDSView:
    name: str
    source_tables: list[str] = field(default_factory=list)
    fields: list[CDSField] = field(default_factory=list)
    joins: list[CDSJoin] = field(default_factory=list)
    where_clause: str = ''
    group_by: list[str] = field(default_factory=list)
    having: str = ''
    annotations: list[str] = field(default_factory=list)


@dataclass
class ABAPSelectStatement:
    fields: list[str] = field(default_factory=list)
    from_table: str = ''
    joins: list[CDSJoin] = field(default_factory=list)
    where_clause: str = ''
    group_by: list[str] = field(default_factory=list)
    having: str = ''
    order_by: list[str] = field(default_factory=list)
    up_to: Optional[int] = None


@dataclass
class BWField:
    name: str
    source_field: Optional[str] = None
    formula: Optional[str] = None
    aggregate: Optional[str] = None


@dataclass
class BWTransformation:
    name: str
    source_fields: list[BWField] = field(default_factory=list)
    target_fields: list[BWField] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)


@dataclass
class ABAPFunctionModule:
    name: str
    parameters: list[str] = field(default_factory=list)
    select_statements: list[ABAPSelectStatement] = field(default_factory=list)
    logic: list[str] = field(default_factory=list)


@dataclass
class ABAPParseResult:
    file_type: ABAPFileType
    cds_view: Optional[CDSView] = None
    select_statements: list[ABAPSelectStatement] = field(default_factory=list)
    bw_transformation: Optional[BWTransformation] = None
    function_module: Optional[ABAPFunctionModule] = None
    warnings: list[str] = field(default_factory=list)


class ABAPParser:
    """Parses ABAP source code and extracts structure."""

    def __init__(self):
        self.lexer = ABAPLexer()

    def detect_file_type(self, content: str) -> ABAPFileType:
        """Detect the type of ABAP file."""
        upper = content.upper().strip()

        if 'DEFINE VIEW' in upper or 'DEFINE VIEW ENTITY' in upper:
            return ABAPFileType.CDS_VIEW
        if '@ENDUSERTEXT' in upper or '@ACCESSCONTROL' in upper:
            return ABAPFileType.CDS_VIEW
        if 'REPORT ' in upper or 'START-OF-SELECTION' in upper:
            return ABAPFileType.ABAP_REPORT
        if 'BEGIN OF TRANSFORMATION' in upper or 'END OF TRANSFORMATION' in upper:
            return ABAPFileType.BW_TRANSFORMATION
        if 'FUNCTION ' in upper and 'ENDFUNCTION' in upper:
            return ABAPFileType.FUNCTION_MODULE
        if 'SELECT ' in upper and 'FROM ' in upper:
            return ABAPFileType.ABAP_REPORT

        return ABAPFileType.UNKNOWN

    def parse(self, content: str) -> ABAPParseResult:
        """Parse ABAP content and return structured result."""
        file_type = self.detect_file_type(content)

        if file_type == ABAPFileType.CDS_VIEW:
            return self._parse_cds_view(content)
        elif file_type == ABAPFileType.ABAP_REPORT:
            return self._parse_report(content)
        elif file_type == ABAPFileType.BW_TRANSFORMATION:
            return self._parse_bw_transformation(content)
        elif file_type == ABAPFileType.FUNCTION_MODULE:
            return self._parse_function_module(content)

        return ABAPParseResult(
            file_type=ABAPFileType.UNKNOWN,
            warnings=['Could not determine file type']
        )

    def _parse_cds_view(self, content: str) -> ABAPParseResult:
        """Parse a CDS View definition."""
        view = CDSView(name='')

        lines = content.split('\n')
        in_body = False

        for line in lines:
            stripped = line.strip()

            if stripped.startswith('@') or stripped.startswith('//@'):
                view.annotations.append(stripped)
                continue

            upper = stripped.upper()

            if 'DEFINE VIEW' in upper and 'AS SELECT' in upper:
                match = __import__('re').search(
                    r'DEFINE\s+(?:VIEW\s+ENTITY\s+)?(\w+)\s+AS\s+SELECT\s+(?:FROM\s+)?(\w+)',
                    stripped, __import__('re').IGNORECASE
                )
                if match:
                    view.name = match.group(1)
                    view.source_tables.append(match.group(2))
                in_body = True
                continue

            if 'FROM' in upper and not in_body:
                match = __import__('re').search(r'FROM\s+(\w+)', stripped, __import__('re').IGNORECASE)
                if match:
                    view.source_tables.append(match.group(1))
                continue

            if 'LEFT' in upper and 'JOIN' in upper:
                match = __import__('re').search(
                    r'LEFT\s+(?:OUTER\s+)?JOIN\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+(.+)',
                    stripped, __import__('re').IGNORECASE
                )
                if match:
                    join = CDSJoin(
                        join_type='LEFT OUTER',
                        table=match.group(1),
                        alias=match.group(2),
                        condition=match.group(3).strip()
                    )
                    view.joins.append(join)
                continue

            if 'INNER' in upper and 'JOIN' in upper:
                match = __import__('re').search(
                    r'INNER\s+JOIN\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+(.+)',
                    stripped, __import__('re').IGNORECASE
                )
                if match:
                    join = CDSJoin(
                        join_type='INNER',
                        table=match.group(1),
                        alias=match.group(2),
                        condition=match.group(3).strip()
                    )
                    view.joins.append(join)
                continue

            if stripped.startswith('}'):
                in_body = False
                continue

            if in_body and stripped and not stripped.startswith('//'):
                field_match = __import__('re').search(
                    r'(?:key\s+)?(\w+(?:\.\w+)?)\s+(?:as\s+)?(\w+)?',
                    stripped, __import__('re').IGNORECASE
                )
                if field_match:
                    field = CDSField(
                        name=field_match.group(1),
                        alias=field_match.group(2),
                        is_key='key' in stripped.lower()
                    )
                    view.fields.append(field)

        return ABAPParseResult(
            file_type=ABAPFileType.CDS_VIEW,
            cds_view=view
        )

    def _parse_report(self, content: str) -> ABAPParseResult:
        """Parse ABAP report with SELECT statements."""
        select_statements = []
        cleaned = self.lexer.remove_comments(content)

        pattern = __import__('re').compile(
            r'SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+INNER\s+JOIN\s+(\w+)\s+ON\s+(.+?))?(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+UP\s+TO\s+(\d+)\s+ROWS)?',
            __import__('re').IGNORECASE | __import__('re').DOTALL
        )

        for match in pattern.finditer(cleaned):
            fields = [f.strip() for f in match.group(1).split(',')]
            stmt = ABAPSelectStatement(
                fields=fields,
                from_table=match.group(2),
                where_clause=match.group(5) or '',
                group_by=[g.strip() for g in (match.group(6) or '').split(',')] if match.group(6) else [],
                order_by=[o.strip() for o in (match.group(7) or '').split(',')] if match.group(7) else [],
                up_to=int(match.group(8)) if match.group(8) else None,
            )

            if match.group(3) and match.group(4):
                stmt.joins.append(CDSJoin(
                    join_type='INNER',
                    table=match.group(3),
                    condition=match.group(4).strip()
                ))

            select_statements.append(stmt)

        report_name = ''
        name_match = __import__('re').search(r'REPORT\s+(\w+)', content, __import__('re').IGNORECASE)
        if name_match:
            report_name = name_match.group(1)

        return ABAPParseResult(
            file_type=ABAPFileType.ABAP_REPORT,
            select_statements=select_statements,
            warnings=[] if select_statements else ['No SELECT statements found']
        )

    def _parse_bw_transformation(self, content: str) -> ABAPParseResult:
        """Parse BW Transformation rules."""
        transformation = BWTransformation(name='')

        name_match = __import__('re').search(
            r'(?:BEGIN\s+OF\s+)?TRANSFORMATION\s+(\w+)',
            content, __import__('re').IGNORECASE
        )
        if name_match:
            transformation.name = name_match.group(1)

        rule_pattern = __import__('re').compile(
            r'(\w+)\s*->\s*(\w+)(?:\s*\((.+?)\))?',
            __import__('re').IGNORECASE
        )

        for match in rule_pattern.finditer(content):
            source = BWField(name=match.group(1))
            target = BWField(
                name=match.group(2),
                formula=match.group(3)
            )
            transformation.source_fields.append(source)
            transformation.target_fields.append(target)

        return ABAPParseResult(
            file_type=ABAPFileType.BW_TRANSFORMATION,
            bw_transformation=transformation
        )

    def _parse_function_module(self, content: str) -> ABAPParseResult:
        """Parse ABAP Function Module."""
        fm = ABAPFunctionModule(name='')

        name_match = __import__('re').search(
            r'FUNCTION\s+(\w+)',
            content, __import__('re').IGNORECASE
        )
        if name_match:
            fm.name = name_match.group(1)

        param_pattern = __import__('re').compile(
            r'(?:USING|CHANGING|TABLES|IMPORTING|EXPORTING)\s+(\w+)',
            __import__('re').IGNORECASE
        )
        for match in param_pattern.finditer(content):
            fm.parameters.append(match.group(1))

        report_result = self._parse_report(content)
        fm.select_statements = report_result.select_statements

        return ABAPParseResult(
            file_type=ABAPFileType.FUNCTION_MODULE,
            function_module=fm
        )
