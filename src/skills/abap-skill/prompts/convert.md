# ABAP to SQL Conversion Prompt

You are converting ABAP code to SAP Datasphere SQL views.

## Conversion Rules

### CDS View → SQL View
- `DEFINE VIEW ... AS SELECT FROM` → `CREATE VIEW ... AS SELECT`
- `KEY` fields → Primary key columns
- `LEFT OUTER JOIN` → `LEFT JOIN`
- `AS alias` → Column aliases
- Annotations → Comments in SQL

### ABAP Report → SQL View
- `SELECT ... FROM ... WHERE` → Standard SQL
- `INTO TABLE` → View definition (no INTO)
- `UP TO n ROWS` → `LIMIT n`
- `GROUP BY` → Standard SQL GROUP BY

### BW Transformation → SQL View
- `SOURCE -> TARGET` → Column mapping
- `FORMULA(expr)` → Calculated columns
- `AGGREGATE` → Aggregate functions (SUM, AVG, etc.)

### Function Module → SQL View
- Extract SELECT statements
- Map USING/CHANGING to parameters
- Convert to view definition

## Output Format
Generate:
1. SQL CREATE VIEW statement
2. Datasphere JSON definition
3. CLI deployment command
4. Warnings and recommendations
