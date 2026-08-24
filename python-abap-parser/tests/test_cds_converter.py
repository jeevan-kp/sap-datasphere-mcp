"""Tests for CDS Converter"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from abap_parser.parser import ABAPParser
from converters.cds_converter import CDSConverter


class TestCDSConverter:
    def setup_method(self):
        self.parser = ABAPParser()
        self.converter = CDSConverter()

    def test_convert_simple_cds_view(self):
        content = """define view ZI_TEST as select from vbak
{
  key vbeln as SalesOrder,
  erdat as CreationDate
}"""
        parsed = self.parser.parse(content)
        result = self.converter.convert(parsed, 'V_TEST', 'TEST_SPACE')

        assert result.sql != ''
        assert 'CREATE VIEW' in result.sql
        assert 'VBAK' in result.sql
        assert result.json_definition != {}
        assert result.cli_command != ''

    def test_convert_cds_with_join(self):
        content = """define view ZI_ORDER as select from vbak
  left outer join vbap on vbak.vbeln = vbap.vbeln
{
  key vbak.vbeln as SalesOrder,
  vbap.matnr as Material
}"""
        parsed = self.parser.parse(content)
        result = self.converter.convert(parsed, 'V_ORDER', 'SALES_SPACE')

        assert 'LEFT JOIN' in result.sql
        assert 'VBAP' in result.sql

    def test_warnings_for_empty_view(self):
        content = """define view ZI_EMPTY as select from vbak
{}"""
        parsed = self.parser.parse(content)
        result = self.converter.convert(parsed, 'V_EMPTY', 'TEST_SPACE')
        assert len(result.warnings) > 0

    def test_complexity_estimation(self):
        content = """define view ZI_COMPLEX as select from vbak
  left outer join vbap on vbak.vbeln = vbap.vbeln
  inner join mara on vbap.matnr = mara.matnr
{
  key vbak.vbeln as SalesOrder,
  vbap.matnr as Material,
  mara.maktx as Description
}"""
        parsed = self.parser.parse(content)
        result = self.converter.convert(parsed, 'V_COMPLEX', 'TEST_SPACE')
        assert result.metadata['complexity'] in ('low', 'medium', 'high')
