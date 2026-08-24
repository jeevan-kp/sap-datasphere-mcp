"""Sample ABAP Report for testing"""
REPORT z_sales_analysis.

DATA: lt_data TYPE TABLE OF vbak,
      ls_data TYPE vbak.

SELECT vbeln erdat audat netwr waers
  FROM vbak
  INTO TABLE lt_data
  WHERE erdat >= sy-datum - 365
    AND netwr > 1000
  ORDER BY netwr DESCENDING.

SELECT vbeln matnr kwmeng netwr
  FROM vbap
  INTO TABLE lt_items
  WHERE vbeln IN s_vbeln.

LOOP AT lt_data INTO ls_data.
  WRITE: / ls_data-vbeln, ls_data-erdat, ls_data-netwr.
ENDLOOP.
