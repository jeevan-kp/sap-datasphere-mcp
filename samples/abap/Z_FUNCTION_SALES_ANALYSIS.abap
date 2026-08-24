*----------------------------------------------------------------------*
* Advanced Function Module - Complex Business Logic
* Demonstrates: SELECT, JOINs, exceptions, complex calculations
*----------------------------------------------------------------------*
FUNCTION z_sd_sales_analysis_report.
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     VALUE(IV_DATE_FROM) TYPE  SY-DATUM
*"     VALUE(IV_DATE_TO) TYPE  SY-DATUM
*"     VALUE(IV_CUSTOMER_GROUP) TYPE  ZCustomerGroup OPTIONAL
*"     VALUE(IV_INCLUDE_RETURNS) TYPE  ABAP_BOOL DEFAULT 'X'
*"  EXPORTING
*"     VALUE(ET_SALES_DATA) TYPE  ZT_SALES_ANALYSIS
*"     VALUE(ET_SUMMARY) TYPE  ZT_SALES_SUMMARY
*"     VALUE(ET_TRENDS) TYPE  ZT_MONTHLY_TRENDS
*"  RAISING
*"     ZCX_SALES_ANALYSIS_ERROR
*"----------------------------------------------------------------------

  DATA: lt_sales TYPE STANDARD TABLE OF ty_sales_data,
        lt_raw_data TYPE STANDARD TABLE OF ty_raw_sales,
        ls_sales TYPE ty_sales_data,
        ls_summary TYPE ty_sales_summary,
        ls_trend TYPE ty_monthly_trend,
        lv_total TYPE p length 15 decimals 2,
        lv_count TYPE i.

  " Validate input parameters
  IF iv_date_from IS INITIAL OR iv_date_to IS INITIAL.
    RAISE EXCEPTION TYPE zcx_sales_analysis_error
      EXPORTING
        textid = zcx_sales_analysis_error=>invalid_date_range
        mv_from = iv_date_from
        mv_to = iv_date_to.
  ENDIF.

  IF iv_date_from > iv_date_to.
    RAISE EXCEPTION TYPE zcx_sales_analysis_error
      EXPORTING
        textid = zcx_sales_analysis_error=>date_from_greater_than_to.
  ENDIF.

  " Complex SELECT with multiple JOINs and CASE
  SELECT
    a~vbeln,
    a~erdat,
    a~kunnr,
    a~netwr,
    a~waerk,
    b~posnr,
    b~matnr,
    b~kwmeng,
    b~meins,
    b~netpr,
    c~name1,
    c~land1,
    d~maktx,
    d~matkl,
    e~bezei AS region_name,
    " Complex calculations
    CASE
      WHEN a~netwr > 500000 THEN 'STRATEGIC'
      WHEN a~netwr > 100000 THEN 'KEY'
      WHEN a~netwr > 10000 THEN 'STANDARD'
      ELSE 'TACTICAL'
    END AS customer_tier,
    " Calculate profit margin
    ( b~netpr - d~stprs ) / b~netpr * 100 AS profit_margin,
    " Calculate days to delivery
    DAYS BETWEEN a~erdat AND a~lfdat AS delivery_days
  FROM vbak AS a
    INNER JOIN vbap AS b ON a~vbeln = b~vbeln
    INNER JOIN kna1 AS c ON a~kunnr = c~kunnr
    LEFT JOIN mara AS d ON b~matnr = d~matnr
    LEFT JOIN tvko AS e ON a~vkorg = e~vkorg
  WHERE
    a~erdat BETWEEN @iv_date_from AND @iv_date_to
    AND a~vbtyp = 'C'
    AND ( @iv_include_returns = 'X' OR a~auart <> 'RE' )
    AND ( @iv_customer_group IS INITIAL OR c~kdkgr = @iv_customer_group )
  INTO TABLE @lt_raw_data.

  " Process raw data with aggregations
  LOOP AT lt_raw_data INTO DATA(ls_raw).
    MOVE-CORRESPONDING ls_raw TO ls_sales.

    " Calculate extended amount
    ls_sales-extended_amount = ls_raw-kwmeng * ls_raw-netpr.

    " Determine material category
    CASE ls_raw-matkl.
      WHEN '001' OR '002'.
        ls_sales-material_category = 'FINISHED'.
      WHEN '003' OR '004'.
        ls_sales-material_category = 'RAW_MATERIAL'.
      WHEN OTHERS.
        ls_sales-material_category = 'OTHER'.
    ENDCASE.

    " Check for returns
    IF ls_raw-auart = 'RE'.
      ls_sales-is_return = 'X'.
      ls_sales-extended_amount = ls_sales-extended_amount * -1.
    ENDIF.

    APPEND ls_sales TO lt_sales.
  ENDLOOP.

  " Aggregate by customer
  LOOP AT lt_sales INTO ls_sales.
    " Find or create summary entry
    READ TABLE et_summary WITH KEY kunnr = ls_sales-kunnr
      ASSIGNING FIELD-SYMBOL(<fs_summary>).

    IF sy-subrc <> 0.
      ls_summary-kunnr = ls_sales-kunnr.
      ls_summary-customer_name = ls_sales-customer_name.
      ls_summary-region = ls_sales-region_name.
      APPEND ls_summary TO et_summary.
      ASSIGN et_summary[ kunnr = ls_sales-kunnr ] TO <fs_summary>.
    ENDIF.

    " Update aggregations
    <fs_summary>-total_sales = <fs_summary>-total_sales + ls_sales-netwr.
    <fs_summary>-order_count = <fs_summary>-order_count + 1.
    <fs_summary>-total_quantity = <fs_summary>-total_quantity + ls_sales-kwmeng.

    " Track top product
    IF ls_sales-kwmeng > <fs_summary>-max_quantity.
      <fs_summary>-top_product = ls_sales-matnr.
      <fs_summary>-max_quantity = ls_sales-kwmeng.
    ENDIF.
  ENDLOOP.

  " Calculate averages
  LOOP AT et_summary ASSIGNING <fs_summary>.
    IF <fs_summary>-order_count > 0.
      <fs_summary>-avg_order_value = <fs_summary>-total_sales / <fs_summary>-order_count.
    ENDIF.
  ENDLOOP.

  " Monthly trend analysis
  SELECT
    SUBSTRING( a~erdat, 1, 6 ) AS month,
    SUM( a~netwr ) AS monthly_sales,
    COUNT( DISTINCT a~vbeln ) AS monthly_orders
  FROM vbak AS a
  WHERE
    a~erdat BETWEEN @iv_date_from AND @iv_date_to
  GROUP BY
    SUBSTRING( a~erdat, 1, 6 )
  ORDER BY
    month ASCENDING
  INTO TABLE @DATA(lt_monthly).

  " Calculate YoY growth
  LOOP AT lt_monthly INTO DATA(ls_monthly).
    ls_trend-month = ls_monthly-month.
    ls_trend-total_sales = ls_monthly-monthly_sales.
    ls_trend-order_count = ls_monthly-monthly_orders.

    " Get same month last year for comparison
    DATA(lv_last_year_month) = ls_monthly-month.
    lv_last_year_month(4) = lv_last_year_month(4) - 1.

    READ TABLE lt_monthly WITH KEY month = lv_last_year_month
      INTO DATA(ls_last_year).

    IF sy-subrc = 0 AND ls_last_year-monthly_sales > 0.
      ls_trend-yoy_growth = ( ls_monthly-monthly_sales - ls_last_year-monthly_sales )
                            / ls_last_year-monthly_sales * 100.
    ENDIF.

    APPEND ls_trend TO et_trends.
  ENDLOOP.

  " Final summary statistics
  DESCRIBE TABLE lt_sales LINES lv_count.
  LOOP AT lt_sales INTO ls_sales.
    lv_total = lv_total + ls_sales-netwr.
  ENDLOOP.

  ls_summary-kunnr = 'TOTAL'.
  ls_summary-customer_name = 'All Customers'.
  ls_summary-total_sales = lv_total.
  ls_summary-order_count = lv_count.
  IF lv_count > 0.
    ls_summary-avg_order_value = lv_total / lv_count.
  ENDIF.
  APPEND ls_summary TO et_summary.

ENDFUNCTION.