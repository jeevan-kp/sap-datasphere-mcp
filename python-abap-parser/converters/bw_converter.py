"""BW Transformation to SQL Converter"""
from typing import Any
from .base import BaseConverter, ConversionOutput
from abap_parser.parser import ABAPParseResult


class BWConverter(BaseConverter):
    """Converts BW Transformation rules to Datasphere SQL views."""

    def convert(self, parsed_data: ABAPParseResult, target_name: str, space_id: str) -> ConversionOutput:
        if not parsed_data.bw_transformation:
            return ConversionOutput(
                sql='',
                warnings=['No BW transformation data found']
            )

        transform = parsed_data.bw_transformation
        sql = self._generate_sql(transform, target_name)
        json_def = self._generate_json(transform, target_name, space_id)
        cli_cmd = self._generate_cli_command(target_name, space_id)

        source_fields = [f.name for f in transform.source_fields]
        target_fields = [f.name for f in transform.target_fields]

        return ConversionOutput(
            sql=sql,
            json_definition=json_def,
            cli_command=cli_cmd,
            warnings=self._check_warnings(transform),
            metadata={
                'sourceTables': [],
                'outputFields': target_fields,
                'complexity': self._estimate_complexity(transform),
                'viewName': target_name,
                'spaceId': space_id,
                'sourceFields': source_fields,
                'targetFields': target_fields,
            }
        )

    def _generate_sql(self, transform: Any, target_name: str) -> str:
        """Generate SQL from BW transformation rules."""
        lines = [f'CREATE VIEW "{target_name}" AS']

        select_parts = []
        for target_field in transform.target_fields:
            if target_field.formula:
                select_parts.append(f'  {target_field.formula} AS "{target_field.name.upper()}"')
            elif target_field.source_field:
                select_parts.append(f'  "{target_field.source_field.upper()}" AS "{target_field.name.upper()}"')
            else:
                select_parts.append(f'  "{target_field.name.upper()}"')

        if not select_parts:
            select_parts = ['  *']

        lines.append('SELECT')
        lines.append(',\n'.join(select_parts))

        if transform.source_fields:
            source_table = transform.source_fields[0].name
            lines.append(f'FROM "{source_table.upper()}"')

        return ';\n'.join(lines) + ';'

    def _generate_json(self, transform: Any, target_name: str, space_id: str) -> dict:
        """Generate Datasphere JSON definition."""
        columns = []
        for field in transform.target_fields:
            columns.append({
                'name': field.name,
                'technicalName': field.name.upper(),
                'dataType': 'DOUBLE' if field.formula else 'NVARCHAR',
                'isKey': False,
            })

        return {
            'technicalName': target_name,
            'description': f'Converted from BW transformation: {transform.name}',
            'spaceId': space_id,
            'columns': columns,
            'sqlDefinition': self._generate_sql(transform, target_name),
        }

    def _generate_cli_command(self, target_name: str, space_id: str) -> str:
        return f'datasphere objects views create --space "{space_id}" --technical-name "{target_name}" --file-path "{target_name}.json"'

    def _check_warnings(self, transform: Any) -> list[str]:
        warnings = []
        if not transform.target_fields:
            warnings.append('No target fields defined in transformation')

        for field in transform.target_fields:
            if field.formula:
                warnings.append(f'Formula detected for {field.name}: verify calculation logic')

        return warnings

    def _estimate_complexity(self, transform: Any) -> str:
        formulas = sum(1 for f in transform.target_fields if f.formula)
        if formulas == 0:
            return 'low'
        elif formulas <= 3:
            return 'medium'
        return 'high'
