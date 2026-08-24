*----------------------------------------------------------------------*
* Advanced ABAP Report - Sales Analysis with Complex Logic
* Demonstrates: SELECT, JOINs, GROUP BY, CASE, subqueries, aggregations
*----------------------------------------------------------------------*
REPORT z_sales_analysis_advanced.

TABLES: vbak, vbap, kna1, mara, tvko.

*----------------------------------------------------------------------*
* Types
*----------------------------------------------------------------------*
TYPES: BEGIN OF ty_sales_data,
         vbeln      TYPE vbak-vbeln,
         erdat      TYPE vbak-erdat,
         kunnr      TYPE vbak-kunnr,
         name1      TYPE kna1-name1,
         netwr      TYPE vbak-netwr,
         waerk      TYPE vbak-waerk,
         matnr      TYPE vbap-matnr,
         maktx      TYPE mara-maktx,
         kwmeng     TYPE vbap-kwmeng,
         meins      TYPE vbap-meins,
         netpr      TYPE vbap-netpr,
         profit     TYPE p length 15 decimals 2,
         category   TYPE char20,
       END OF ty_sales_data,

       BEGIN OF ty_summary,
         kunnr      TYPE vbak-kunnr,
         name1      TYPE kna1-name1,
         total_sales TYPE p length 15 decimals 2,
         order_count TYPE i,
         avg_order  TYPE p length 15 decimals 2,
         top_product TYPE matnr,
       END OF ty_summary,

       BEGIN OF ty_monthly_trend,
         month      TYPE char7,
         total_sales TYPE p length 15 decimals 2,
         yoy_growth TYPE p length 5 decimals 2,
       END OF ty_monthly_trend.

*----------------------------------------------------------------------*
* Data Declarations
*----------------------------------------------------------------------*
DATA: lt_sales     TYPE STANDARD TABLE OF ty_sales_data,
      ls_sales     TYPE ty_sales_data,
      lt_summary   TYPE STANDARD TABLE OF ty_summary,
      ls_summary   TYPE ty_summary,
      lt_trends    TYPE STANDARD TABLE OF ty_monthly_trend,
      ls_trend     TYPE ty_monthly_trend.

DATA: lv_date_from TYPE sy-datum,
      lv_date_to   TYPE sy-datum,
      lv_lines     TYPE i,
      lv_total     TYPE p length 15 decimals 2.

*----------------------------------------------------------------------*
* Selection Screen
*----------------------------------------------------------------------*
SELECT-OPTIONS: s_date FOR vbak-erdat,
                s_kunnr FOR vbak-kunnr,
                s_vkorg FOR vbak-vkorg,
                s_auart FOR vbak-auart.

PARAMETERS:     p_show TYPE c as checkbox default 'X'.

*----------------------------------------------------------------------*
* Main Processing
*----------------------------------------------------------------------*
START-OF-SELECTION.

  " Calculate date range
  lv_date_from = s_date-low.
  lv_date_to = s_date-high.
  IF lv_date_to IS INITIAL.
    lv_date_to = sy-datum.
  ENDIF.

  " Complex SELECT with JOINs, CASE, and aggregations
  SELECT
    a~vbeln,
    a~erdat,
    a~kunnr,
    c~name1,
    a~netwr,
    a~waerk,
    b~matnr,
    d~maktx,
    b~kwmeng,
    b~meins,
    b~netpr,
    " Calculate profit margin
    ( b~netpr * b~kwmeng * 0.3 ) AS profit,
    " Categorize order size
    CASE
      WHEN a~netwr > 100000 THEN 'LARGE'
      WHEN a~netwr > 50000 THEN 'MEDIUM'
      WHEN a~netwr > 10000 THEN 'SMALL'
      ELSE 'MICRO'
    END AS category
  FROM vbak AS a
    INNER JOIN vbap AS b ON a~vbeln = b~vbeln
    INNER JOIN kna1 AS c ON a~kunnr = c~kunnr
    LEFT JOIN mara AS d ON b~matnr = d~matnr
  WHERE
    a~erdat BETWEEN lv_date_from AND lv_date_to
    AND a~kunnr IN @s_kunnr
    AND a~vkorg IN @s_vkorg
    AND a~auart IN @s_auart
    AND a~vbtyp = 'C'
  INTO TABLE @lt_sales.

  " Get line count
  DESCRIBE TABLE lt_sales LINES lv_lines.

  " Aggregate by customer
  SELECT
    a~kunnr,
    c~name1,
    SUM( a~netwr ) AS total_sales,
    COUNT( DISTINCT a~vbeln ) AS order_count,
    AVG( a~netwr ) AS avg_order,
    " Get top product using subquery
    ( SELECT SINGLE b~matnr
      FROM vbap AS b
      WHERE b~vbeln = a~vbeln
      ORDER BY b~kwmeng DESCENDING
      INTO @DATA(lv_top_product) )
  FROM vbak AS a
    INNER JOIN kna1 AS c ON a~kunnr = c~kunnr
  WHERE
    a~erdat BETWEEN lv_date_from AND lv_date_to
  GROUP BY
    a~kunnr, c~name1
  HAVING
    SUM( a~netwr ) > 10000
  ORDER BY
    total_sales DESCENDING
  INTO TABLE @lt_summary.

  " Monthly trend analysis with YoY comparison
  SELECT
    SUBSTRING( a~erdat, 1, 6 ) AS month,
    SUM( a~netwr ) AS total_sales,
    " Calculate YoY growth using window function pattern
    ( SUM( a~netwr ) - LAG( SUM( a~netwr ), 12 ) OVER (
        ORDER BY SUBSTRING( a~erdat, 1, 6 )
    ) ) / LAG( SUM( a~netwr ), 12 ) OVER (
        ORDER BY SUBSTRING( a~erdat, 1, 6 )
    ) * 100 AS yoy_growth
  FROM vbak AS a
  WHERE
    a~erdat BETWEEN @lv_date_from AND @lv_date_to
  GROUP BY
    SUBSTRING( a~erdat, 1, 6 )
  INTO TABLE @lt_trends.

  " Output results
  IF p_show = 'X'.
    WRITE: / 'Sales Analysis Report'.
    WRITE: / '===================='.
    WRITE: / 'Period:', lv_date_from, 'to', lv_date_to.
    WRITE: / 'Total Orders:', lv_lines.
    SKIP.

    " Customer summary
    WRITE: / 'Top Customers by Sales'.
    LOOP AT lt_summary INTO ls_summary.
      WRITE: / ls_summary-kunnr,
               ls_summary-name1,
               ls_summary-total_sales CURRENCY 'EUR',
               ls_summary-order_count.
    ENDLOOP.
  ENDIF.

*----------------------------------------------------------------------*
* Event handler for ALV output
*----------------------------------------------------------------------*
CLASS lcl_sales_analysis DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS:
      display_alv,
      calculate_profitability IMPORTING iv_margin TYPE p.

    DATA: mt_sales TYPE STANDARD TABLE OF ty_sales_data.
ENDCLASS.

CLASS lcl_sales_analysis IMPLEMENTATION.
  METHOD display_alv.
    " Use cl_salv_table for ALV display
    DATA: lo_alv TYPE REF TO cl_salv_table.

    TRY.
        cl_salv_table=>factory(
          IMPORTING
            r_salv_table = lo_alv
          CHANGING
            t_table      = lt_sales ).

        " Configure columns
        DATA(lo_columns) = lo_alv->get_columns( ).
        lo_columns->set_optimize( ).

        " Set column texts
        DATA(lo_col) = lo_columns->get_column( 'SALESORDER' ).
        lo_col->set_short_text( 'Order' ).
        lo_col->set_medium_text( 'Sales Order' ).
        lo_col->set_long_text( 'Sales Order Number' ).

        " Enable aggregations
        DATA(lo_aggr) = lo_alv->get_aggregations( ).
        lo_aggr->add_aggregation(
          columnname  = 'NETWR'
          aggregation = if_salv_c_aggregation=>total ).

        " Display
        lo_alv->display( ).

      CATCH cx_salv_msg cx_salv_not_found INTO DATA(lx_error).
        MESSAGE lx_error->get_text( ) TYPE 'E'.
    ENDTRY.
  ENDMETHOD.

  METHOD calculate_profitability.
    " Complex profitability calculation
    DATA: lv_total_revenue TYPE p length 15 decimals 2,
          lv_total_cost    TYPE p length 15 decimals 2,
          lv_profit_margin TYPE p length 5 decimals 2.

    LOOP AT lt_sales INTO ls_sales.
      lv_total_revenue = lv_total_revenue + ls_sales-netwr.
      lv_total_cost = lv_total_cost + ( ls_sales-netpr * ls_sales-kwmeng ).
    ENDLOOP.

    IF lv_total_cost > 0.
      lv_profit_margin = ( lv_total_revenue - lv_total_cost ) / lv_total_revenue * 100.
    ENDIF.
  ENDMETHOD.
ENDCLASS.