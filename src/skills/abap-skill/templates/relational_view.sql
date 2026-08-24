CREATE VIEW "{view_name}" AS
SELECT
{field_list}
FROM "{source_table}" T0
{joins}
{where_clause}
{group_by};
