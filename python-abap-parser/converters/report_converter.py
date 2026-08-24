"""ABAP Report to SQL Converter"""
from typing import Any
from .base import BaseConverter, ConversionOutput
from abap_parser.parser import ABAPParseResult


class ReportConverter(BaseConverter):
    """Converts ABAP Report SELECT statements to Datasphere SQL views."""

    def convert(self, parsed_data: ABAPParseResult, target_name: str, space_id: str) -> ConversionOutput:
        if not parsed_data.select_statements:
            return ConversionOutput(
                sql='',
                warnings=['No SELECT statements found in ABAP report']
            )

        sql = self._generate_sql(parsed_data, target_name)
        json_def = self._generate_json(parsed_data, target_name, space_id)
        cli_cmd = self._generate_cli_command(target_name, space_id)

        tables = list({s.from_table for s in parsed_data.select_statements})
        fields = []
        for stmt in parsed_data.select_statements:
            fields.extend(stmt.fields)

        return ConversionOutput(
            sql=sql,
            json_definition=json_def,
            cli_command=cli_cmd,
            warnings=self._check_warnings(parsed_data),
            metadata={
                'sourceTables': tables,
                'outputFields': list(set(fields)),
                'complexity': self._estimate_complexity(parsed_data),
                'viewName': target_name,
                'spaceId': space_id,
                'selectCount': len(parsed_data.select_statements),
            }
        )

    def _generate_sql(self, parsed_data: ABAPParseResult, target_name: str) -> str:
        """Generate SQL from SELECT statements."""
        if len(parsed_data.select_statements) == 1:
            return self._single_select_to_sql(parsed_data.select_statements[0], target_name)
        return self._multi_select_to_sql(parsed_data.select_statements, target_name)

    def _single_select_to_sql(self, stmt: Any, target_name: str) -> str:
        """Convert a single SELECT statement to CREATE VIEW."""
        lines = [f'CREATE VIEW "{target_name}" AS']

        fields = ', '.join([f'"{f.upper()}"' for f in stmt.fields]) if stmt.fields else '*'
        lines.append(f'SELECT {fields}')
        lines.append(f'FROM "{stmt.from_table.upper()}"')

        for join in stmt.joins:
            join_type = join.join_type.upper()
            lines.append(f'{join_type} JOIN "{join.table.upper()}"')
            lines.append(f'  ON {join.condition}')

        if stmt.where_clause:
            lines.append(f'WHERE {stmt.where_clause}')

        if stmt.group_by:
            lines.append(f'GROUP BY {", ".join(stmt.group_by)}')

        if stmt.order_by:
            lines.append(f'ORDER BY {", ".join(stmt.order_by)}')

        if stmt.up_to:
            lines.append(f'LIMIT {stmt.up_to}')

        return ';\n'.join(lines) + ';'

    def _multi_select_to_sql(self, stmts: list, target_name: str) -> str:
        """Convert multiple SELECT statements - use UNION if compatible."""
        if self._can_union(stmts):
            return self._union_select_to_sql(stmts, target_name)

        first = stmts[0]
        return self._single_select_to_sql(first, target_name)

    def _can_union(self, stmts: list) -> bool:
        """Check if SELECT statements can be UNIONed."""
        if len(stmts) < 2:
            return False

        field_counts = [len(s.fields) for s in stmts]
        return len(set(field_counts)) == 1

    def _union_select_to_sql(self, stmts: list, target_name: str) -> str:
        """Generate UNION view from multiple SELECT statements."""
        parts = []
        for stmt in stmts:
            fields = ', '.join([f'"{f.upper()}"' for f in stmt.fields])
            part = f'SELECT {fields} FROM "{stmt.from_table.upper()}"'
            if stmt.where_clause:
                part += f' WHERE {stmt.where_clause}'
            parts.append(part)

        union_sql = '\nUNION ALL\n'.join(parts)
        return f'CREATE VIEW "{target_name}" AS\n{union_sql};'

    def _generate_json(self, parsed_data: ABAPParseResult, target_name: str, space_id: str) -> dict:
        """Generate Datasphere JSON definition."""
        tables = list({s.from_table for s in parsed_data.select_statements})
        all_fields = []
        for stmt in parsed_data.select_statements:
            all_fields.extend(stmt.fields)

        columns = []
        for field in list(set(all_fields)):
            columns.append({
                'name': field.upper(),
                'technicalName': field.upper(),
                'dataType': 'NVARCHAR',
            })

        return {
            'technicalName': target_name,
            'description': f'Converted from ABAP report',
            'spaceId': space_id,
            'columns': columns,
            'sqlDefinition': self._generate_sql(parsed_data, target_name),
        }

    def _generate_cli_command(self, target_name: str, space_id: str) -> str:
        return f'datasphere objects views create --space "{space_id}" --technical-name "{target_name}" --file-path "{target_name}.json"'

    def _check_warnings(self, parsed_data: ABAPParseResult) -> list[str]:
        warnings = []
        if len(parsed_data.select_statements) > 1:
            warnings.append(f'{len(parsed_data.select_statements)} SELECT statements found - using first statement for view definition')

        for stmt in parsed_data.select_statements:
            if stmt.up_to:
                warnings.append(f'LIMIT {stmt.up_to} detected - view will include all matching rows')

        return warnings

    def _estimate_complexity(self, parsed_data: ABAPParseResult) -> str:
        total_fields = sum(len(s.fields) for s in parsed_data.select_statements)
        total_joins = sum(len(s.joins) for s in parsed_data.select_statements)

        if total_fields <= 10 and total_joins <= 1:
            return 'low'
        elif total_fields <= 20 and total_joins <= 3:
            return 'medium'
        return 'high'
