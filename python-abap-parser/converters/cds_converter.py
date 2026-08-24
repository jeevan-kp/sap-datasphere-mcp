"""CDS View to SQL Converter"""
from typing import Any
from .base import BaseConverter, ConversionOutput
from abap_parser.parser import ABAPParseResult, CDSView


class CDSConverter(BaseConverter):
    """Converts CDS View definitions to Datasphere SQL views."""

    def convert(self, parsed_data: ABAPParseResult, target_name: str, space_id: str) -> ConversionOutput:
        if not parsed_data.cds_view:
            return ConversionOutput(
                sql='',
                warnings=['No CDS view data found in parsed content']
            )

        view = parsed_data.cds_view
        sql = self._generate_sql(view, target_name)
        json_def = self._generate_json(view, target_name, space_id)
        cli_cmd = self._generate_cli_command(target_name, space_id)

        return ConversionOutput(
            sql=sql,
            json_definition=json_def,
            cli_command=cli_cmd,
            warnings=self._check_warnings(view),
            metadata={
                'sourceTables': view.source_tables,
                'outputFields': [f.alias or f.name for f in view.fields],
                'complexity': self._estimate_complexity(view),
                'viewName': target_name,
                'spaceId': space_id,
            }
        )

    def _generate_sql(self, view: CDSView, target_name: str) -> str:
        """Generate SQL CREATE VIEW statement."""
        lines = [f'CREATE VIEW "{target_name}" AS']

        select_parts = []
        for i, field in enumerate(view.fields):
            col = f'  T{i}."{field.name.upper()}"'
            if field.alias:
                col += f' AS "{field.alias.upper()}"'
            select_parts.append(col)

        if not select_parts:
            select_parts = ['  *']

        lines.append('SELECT')
        lines.append(',\n'.join(select_parts))

        if view.source_tables:
            lines.append(f'FROM "{view.source_tables[0].upper()}" T0')

        for i, join in enumerate(view.joins):
            table_alias = join.alias or f'T{i + 1}'
            join_type = join.join_type.upper()
            lines.append(f'{join_type} JOIN "{join.table.upper()}" {table_alias}')
            lines.append(f'  ON {join.condition}')

        if view.where_clause:
            lines.append(f'WHERE {view.where_clause}')

        if view.group_by:
            lines.append(f'GROUP BY {", ".join(view.group_by)}')

        if view.having:
            lines.append(f'HAVING {view.having}')

        return ';\n'.join(lines) + ';'

    def _generate_json(self, view: CDSView, target_name: str, space_id: str) -> dict:
        """Generate Datasphere JSON definition for CLI deployment."""
        columns = []
        for field in view.fields:
            col = {
                'name': field.alias or field.name,
                'technicalName': field.name.upper(),
                'dataType': field.data_type or 'NVARCHAR',
                'isKey': field.is_key,
            }
            columns.append(col)

        return {
            'technicalName': target_name,
            'description': f'Converted from CDS view: {view.name}',
            'spaceId': space_id,
            'columns': columns,
            'sqlDefinition': self._generate_sql(view, target_name),
        }

    def _generate_cli_command(self, target_name: str, space_id: str) -> str:
        """Generate the CLI command to create this view."""
        return f'datasphere objects views create --space "{space_id}" --technical-name "{target_name}" --file-path "{target_name}.json"'

    def _check_warnings(self, view: CDSView) -> list[str]:
        """Check for potential issues in the conversion."""
        warnings = []

        if not view.fields:
            warnings.append('No fields found in CDS view - using SELECT *')

        if not view.source_tables:
            warnings.append('No source tables identified')

        for field in view.fields:
            if field.data_type in ('QUAN', 'CURR'):
                warnings.append(f'Field {field.name} is {field.data_type} type - consider unit/currency conversion')

        if len(view.joins) > 3:
            warnings.append(f'Complex join structure with {len(view.joins)} joins - verify performance')

        return warnings

    def _estimate_complexity(self, view: CDSView) -> str:
        """Estimate conversion complexity."""
        score = 0
        score += len(view.fields) * 0.5
        score += len(view.joins) * 2
        score += 1 if view.where_clause else 0
        score += len(view.group_by) * 1.5
        score += 1 if view.having else 0

        if score <= 5:
            return 'low'
        elif score <= 15:
            return 'medium'
        return 'high'
