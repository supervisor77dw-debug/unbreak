-- Nur lesend (eine SELECT-Anweisung): zaehlt Vorkommen der alten Bezeichnung
-- je Tabelle und Spalte (AW-20261105-DK-CLAUDE-UNBREAK-FLEXIGEL-UMSTELLUNG-001).
-- Gibt nur Zaehlwerte und Artikelstammdaten aus, keine Kundendaten.

WITH cols AS (
  SELECT c.table_name, c.column_name,
    (xpath('/row/c/text()', query_to_xml(format(
      'SELECT count(*) AS c FROM public.%I WHERE %I::text ~* %L',
      c.table_name, c.column_name, 'nano[ _-]?gel'
    ), false, true, '')))[1]::text::bigint AS n
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND c.data_type IN ('text', 'character varying', 'json', 'jsonb', 'ARRAY')
)
SELECT 'treffer' AS art, table_name AS objekt, column_name AS detail, n::text AS wert
FROM cols WHERE n > 0
UNION ALL
SELECT 'trigger', event_object_table, trigger_name, action_timing || ' ' || event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'products'
UNION ALL
SELECT 'artikel', sku, name,
  base_price_cents::text || ' | ' || active::text || ' | ' || coalesce(status::text, '-')
FROM public.products
ORDER BY 1, 2, 3;
