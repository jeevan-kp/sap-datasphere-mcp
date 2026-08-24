*----------------------------------------------------------------------*
* BW Transformation with Advanced ABAP Routines
* Demonstrates: Complex transformations, lookups, aggregations, formulas
*----------------------------------------------------------------------*
BEGIN OF TRANSFORMATION z_trans_sales_enhanced
  SOURCE STRUCTURE zts_sales_raw
  TARGET STRUCTURE zts_sales_enhanced.

  INCLUDE STRUCTURE zts_sales_common.

  "-----------------------------------------------
  " Transformation Rule: Sales Amount with Discount
  "-----------------------------------------------
  RULES FOR FIELDS ( net_amount, discount_pct, gross_amount ).

    " Source field mapping with calculation
    FIELD ( net_amount ) =
      SOURCE_FIELDS-sales_amount
      * ( 1 - SOURCE_FIELDS-discount_rate / 100 ).

    " Calculate discount percentage
    FIELD ( discount_pct ) =
      SOURCE_FIELDS-discount_rate.

    " Gross amount before discount
    FIELD ( gross_amount ) =
      SOURCE_FIELDS-sales_amount.

  ENDRULES.

  "-----------------------------------------------
  " Transformation Rule: Customer Classification
  "-----------------------------------------------
  RULES FOR FIELDS ( customer_category, risk_level ).

    " ABAP routine for complex classification
    METHOD customer_classification.

      DATA: lv_customer_id TYPE kunnr,
            lv_total_sales TYPE p length 15 decimals 2,
            lv_credit_limit TYPE p length 15 decimals 2,
            lv_risk_score TYPE i.

      " Lookup customer data from master table
      SELECT SINGLE
        kunnr,
        name1,
        ort01,
        land1
      FROM kna1
      WHERE kunnr = @SOURCE_FIELDS-customer_id
      INTO @DATA(ls_customer).

      " Get historical sales data
      SELECT
        SUM( netwr ) AS total_sales
      FROM vbak
      WHERE kunnr = @SOURCE_FIELDS-customer_id
        AND erdat BETWEEN @CONV #( sy-datum - 365 ) AND @sy-datum
      INTO @lv_total_sales.

      " Get credit limit
      SELECT SINGLE
        klimk
      FROM knkk
      WHERE kunnr = @SOURCE_FIELDS-customer_id
      INTO @lv_credit_limit.

      " Complex risk calculation
      lv_risk_score = 0.

      " Factor 1: Sales volume
      IF lv_total_sales > 1000000.
        lv_risk_score = lv_risk_score + 1.
      ENDIF.

      " Factor 2: Credit utilization
      IF lv_credit_limit > 0.
        DATA(lv_utilization) = lv_total_sales / lv_credit_limit * 100.
        IF lv_utilization > 80.
          lv_risk_score = lv_risk_score + 2.
        ELSEIF lv_utilization > 50.
          lv_risk_score = lv_risk_score + 1.
        ENDIF.
      ENDIF.

      " Factor 3: Payment history
      SELECT
        COUNT(*) AS late_payments
      FROM bseg
      WHERE kunnr = @SOURCE_FIELDS-customer_id
        AND zfbdt < @sy-datum
        AND zlspr = 'X'
      INTO @DATA(lv_late_payments).

      IF lv_late_payments > 3.
        lv_risk_score = lv_risk_score + 3.
      ELSEIF lv_late_payments > 0.
        lv_risk_score = lv_risk_score + 1.
      ENDIF.

      " Determine category based on risk score
      CASE lv_risk_score.
        WHEN 0.
          TARGET_FIELDS-customer_category = 'GOLD'.
          TARGET_FIELDS-risk_level = 'LOW'.
        WHEN 1.
          TARGET_FIELDS-customer_category = 'SILVER'.
          TARGET_FIELDS-risk_level = 'LOW'.
        WHEN 2.
          TARGET_FIELDS-customer_category = 'BRONZE'.
          TARGET_FIELDS-risk_level = 'MEDIUM'.
        WHEN OTHERS.
          TARGET_FIELDS-customer_category = 'STANDARD'.
          TARGET_FIELDS-risk_level = 'HIGH'.
      ENDCASE.

    ENDMETHOD.

  ENDRULES.

  "-----------------------------------------------
  " Transformation Rule: Date Enrichment
  "-----------------------------------------------
  RULES FOR FIELDS ( fiscal_year, fiscal_quarter, fiscal_month, day_of_week ).

    METHOD date_enrichment.

      DATA: lv_date TYPE sy-datum,
            lv_year TYPE numc4,
            lv_month TYPE numc2,
            lv_day TYPE numc2.

      lv_date = SOURCE_FIELDS-order_date.

      " Extract date components
      lv_year = lv_date+0(4).
      lv_month = lv_date+4(2).
      lv_day = lv_date+6(2).

      " Fiscal year calculation (assuming April-March fiscal year)
      IF lv_month >= 4.
        TARGET_FIELDS-fiscal_year = lv_year + 1.
      ELSE.
        TARGET_FIELDS-fiscal_year = lv_year.
      ENDIF.

      " Fiscal quarter
      CASE lv_month.
        WHEN '04' OR '05' OR '06'.
          TARGET_FIELDS-fiscal_quarter = 'Q1'.
        WHEN '07' OR '08' OR '09'.
          TARGET_FIELDS-fiscal_quarter = 'Q2'.
        WHEN '10' OR '11' OR '12'.
          TARGET_FIELDS-fiscal_quarter = '3'.
        WHEN OTHERS.
          TARGET_FIELDS-fiscal_quarter = 'Q4'.
      ENDCASE.

      " Fiscal month
      TARGET_FIELDS-fiscal_month = lv_month.

      " Day of week using function module
      CALL FUNCTION 'BPW_DATE_GET_WEEKDAY'
        EXPORTING
          date = lv_date
        IMPORTING
          weekday = TARGET_FIELDS-day_of_week.

    ENDMETHOD.

  ENDRULES.

  "-----------------------------------------------
  " Transformation Rule: Currency Conversion
  "-----------------------------------------------
  RULES FOR FIELDS ( amount_usd, amount_eur, conversion_date ).

    METHOD currency_conversion.

      DATA: lv_amount TYPE p length 15 decimals 2,
            lv_rate TYPE p length 8 decimals 4.

      lv_amount = SOURCE_FIELDS-net_amount.

      " Get exchange rate from custom table
      SELECT SINGLE
        rate
      FROM ztb_exchange_rates
      WHERE from_currency = SOURCE_FIELDS-currency
        AND to_currency = 'USD'
        AND valid_date <= SOURCE_FIELDS-order_date
      ORDER BY valid_date DESCENDING
      INTO @lv_rate.

      IF sy-subrc = 0.
        TARGET_FIELDS-amount_usd = lv_amount * lv_rate.
      ELSE.
        TARGET_FIELDS-amount_usd = lv_amount. " Default to original
      ENDIF.

      " Convert to EUR
      SELECT SINGLE
        rate
      FROM ztb_exchange_rates
      WHERE from_currency = SOURCE_FIELDS-currency
        AND to_currency = 'EUR'
        AND valid_date <= SOURCE_FIELDS-order_date
      ORDER BY valid_date DESCENDING
      INTO @lv_rate.

      IF sy-subrc = 0.
        TARGET_FIELDS-amount_eur = lv_amount * lv_rate.
      ENDIF.

      TARGET_FIELDS-conversion_date = SOURCE_FIELDS-order_date.

    ENDMETHOD.

  ENDRULES.

  "-----------------------------------------------
  " Transformation Rule: Material Description Lookup
  "-----------------------------------------------
  RULES FOR FIELDS ( material_description, material_group, material_type ).

    METHOD material_lookup.

      " Multi-table lookup for material enrichment
      SELECT SINGLE
        b~maktx,
        a~matkl,
        a~mtart
      FROM mara AS a
        INNER JOIN makt AS b ON a~matnr = b~matnr
      WHERE a~matnr = @SOURCE_FIELDS-material_id
        AND b~spras = @sy-langu
      INTO (
        TARGET_FIELDS-material_description,
        TARGET_FIELDS-material_group,
        TARGET_FIELDS-material_type
      ).

      IF sy-subrc <> 0.
        TARGET_FIELDS-material_description = 'Unknown Material'.
      ENDIF.

    ENDMETHOD.

  ENDRULES.

  "-----------------------------------------------
  " Aggregation Rule: Running Total
  "-----------------------------------------------
  RULES FOR FIELDS ( running_total, cumulative_avg ).

    METHOD running_total_calc.

      " Window function simulation using READ TABLE
      DATA: lv_running_total TYPE p length 15 decimals 2,
            lv_count TYPE i VALUE 0,
            lv_sum TYPE p length 15 decimals 2.

      " Sort by date for running total
      SORT gt_sales_data BY order_date.

      LOOP AT gt_sales_data INTO DATA(ls_data).
        lv_running_total = lv_running_total + ls_data-net_amount.
        lv_count = lv_count + 1.
        lv_sum = lv_sum + ls_data-net_amount.

        IF ls_data-vbeln = SOURCE_FIELDS-vbeln.
          TARGET_FIELDS-running_total = lv_running_total.
          TARGET_FIELDS-cumulative_avg = lv_sum / lv_count.
          EXIT.
        ENDIF.
      ENDLOOP.

    ENDMETHOD.

  ENDRULES.

END OF TRANSFORMATION.