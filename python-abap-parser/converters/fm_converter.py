"""Function Module to SQL Converter"""
from typing import Any
from .base import BaseConverter, ConversionOutput
from abap_parser.parser import ABAPParseResult


class FMConverter(BaseConverter):
    """Converts ABAP Function Modules to Datasphere SQL views."""

    def convert(self, parsed_data: ABAPParseResult, target_name: str, space_id: str) -> ConversionOutput:
        if not parsed_data.function_module:
            return ConversionOutput(
                sql='',
                warnings=['No function module data found']
            )

        fm = parsed_data.function_module
        sql = self._generate_sql(fm, target_name)
        json_def = self._generate_json(fm, target_name, space_id)
        cli_cmd = self._generate_cli_command(target_name, space_id)

        tables = list({s.from_table for s in fm.select_statements})
        fields = []
        for stmt in fm.select_statements:
            fields.extend(stmt.fields)

        return ConversionOutput(
            sql=sql,
            json_definition=json_def,
            cli_command=cli_cmd,
            warnings=self._check_warnings(fm),
            metadata={
                'sourceTables': tables,
                'outputFields': list(set(fields)),
                'complexity': 'medium',
                'viewName': target_name,
                'spaceId': space_id,
                'functionModuleName': fm.name,
                'parameters': fm.parameters,
            }
        )

    def _generate_sql(self, fm: Any, target_name: str) -> str:
        """Generate SQL from function module SELECT statements."""
        if not fm.select_statements:
            return f'-- No SELECT statements found in function module {fm.name}\n-- Manual conversion may be required'

        stmt = fm.select_statements[0]
        lines = [f'CREATE VIEW "{target_name}" AS']

        fields = ', '.join([f'"{f.upper()}"' for f in stmt.fields]) if stmt.fields else '*'
        lines.append(f'SELECT {fields}')
        lines.append(f'FROM "{stmt.from_table.upper()}"')

        for join in stmt.joins:
            lines.append(f'{join.join_type.upper()} JOIN "{join.table.upper()}"')
            lines.append(f'  ON {join.condition}')

        if stmt.where_clause:
            lines.append(f'WHERE {stmt.where_clause}')

        if stmt.group_by:
            lines.append(f'GROUP BY {", ".join(stmt.group_by)}')

        return ';\n'.join(lines) + ';'

    def _generate_json(self, fm: Any, target_name: str, space_id: str) -> dict:
        """Generate Datasphere JSON definition."""
        columns = []
        for stmt in fm.select_statements:
            for field in stmt.fields:
                columns.append({
                    'name': field.upper(),
                    'technicalName': field.upper(),
                    'dataType': 'NVARCHAR',
                })

        return {
            'technicalName': target_name,
            'description': f'Converted from function module: {fm.name}',
            'spaceId': space_id,
            'columns': columns,
            'sqlDefinition': self._generate_sql(fm, target_name),
        }

    def _generate_cli_command(self, target_name: str, space_id: str) -> str:
        return f'datasphere objects views create --space "{space_id}" --technical-name "{target_name}" --file-path "{target_name}.json"'

    def _check_warnings(self, fm: Any) -> list[str]:
        warnings = []
        if not fm.select_statements:
            warnings.append('Function module contains no SELECT statements - view will be empty')
        if len(fm.select_statements) > 1:
            warnings.append(f'{len(fm.select_statements)} SELECT statements found - using first for view')
        return warnings

    def _estimate_complexity(self, fm: Any) -> str:
        return 'medium'
