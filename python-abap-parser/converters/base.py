"""Base converter class"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ConversionOutput:
    sql: str
    json_definition: dict[str, Any] = field(default_factory=dict)
    cli_command: str = ''
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseConverter(ABC):
    """Base class for ABAP to SQL converters."""

    @abstractmethod
    def convert(self, parsed_data: Any, target_name: str, space_id: str) -> ConversionOutput:
        """Convert parsed ABAP data to SQL view definition."""
        pass

    def _sanitize_name(self, name: str) -> str:
        """Sanitize identifier for SQL."""
        return name.upper().replace('-', '_').replace('/', '_')

    def _map_abap_type(self, abap_type: str) -> str:
        """Map ABAP data type to SQL type."""
        type_map = {
            'CHAR': 'NVARCHAR',
            'VARCHAR': 'NVARCHAR',
            'STRING': 'NCLOB',
            'NUMC': 'NVARCHAR',
            'INT1': 'SMALLINT',
            'INT2': 'SMALLINT',
            'INT4': 'INTEGER',
            'INT8': 'BIGINT',
            'DEC': 'DECIMAL',
            'QUAN': 'DECIMAL',
            'CURR': 'DECIMAL',
            'FLTP': 'DOUBLE',
            'DATS': 'DATE',
            'TIMS': 'TIME',
            'TIMESTAMP': 'TIMESTAMP',
            'BOOLEAN': 'BOOLEAN',
        }
        return type_map.get(abap_type.upper(), 'NVARCHAR')
