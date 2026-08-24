"""Tests for ABAP Parser"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from abap_parser.parser import ABAPParser, ABAPFileType


class TestABAPParser:
    def setup_method(self):
        self.parser = ABAPParser()

    def test_detect_cds_view(self):
        content = """@AccessControl.authorizationCheck: #CHECK
define view ZI_SALES as select from vbak
{
  key vbeln as SalesOrder
}"""
        assert self.parser.detect_file_type(content) == ABAPFileType.CDS_VIEW

    def test_detect_abap_report(self):
        content = """REPORT z_test.

SELECT vbeln erdat FROM vbak
  INTO TABLE lt_data."""
        assert self.parser.detect_file_type(content) == ABAPFileType.ABAP_REPORT

    def test_detect_bw_transformation(self):
        content = """BEGIN OF TRANSFORMATION z_test
  SOURCE QTY PRICE
  TARGET AMOUNT (QTY * PRICE)
END OF TRANSFORMATION"""
        assert self.parser.detect_file_type(content) == ABAPFileType.BW_TRANSFORMATION

    def test_detect_function_module(self):
        content = """FUNCTION z_get_data.
  SELECT * FROM vbak.
ENDFUNCTION."""
        assert self.parser.detect_file_type(content) == ABAPFileType.FUNCTION_MODULE

    def test_parse_cds_view(self):
        content = """define view ZI_TEST as select from vbak
{
  key vbeln as SalesOrder,
  erdat as CreationDate,
  netwr as NetValue
}"""
        result = self.parser.parse(content)
        assert result.file_type == ABAPFileType.CDS_VIEW
        assert result.cds_view is not None
        assert result.cds_view.name == 'ZI_TEST'
        assert 'vbak' in result.cds_view.source_tables
        assert len(result.cds_view.fields) >= 2

    def test_parse_cds_with_join(self):
        content = """define view ZI_ORDER as select from vbak
  left outer join vbap on vbak.vbeln = vbap.vbeln
{
  key vbak.vbeln as SalesOrder,
  vbap.matnr as Material
}"""
        result = self.parser.parse(content)
        assert result.file_type == ABAPFileType.CDS_VIEW
        assert len(result.cds_view.joins) == 1
        assert result.cds_view.joins[0].join_type == 'LEFT OUTER'

    def test_parse_select_statement(self):
        content = """SELECT vbeln erdat FROM vbak
  WHERE erdat >= '20240101'
  ORDER BY vbeln."""
        result = self.parser.parse(content)
        assert result.file_type == ABAPFileType.ABAP_REPORT
        assert len(result.select_statements) >= 1
        assert result.select_statements[0].from_table == 'vbak'
