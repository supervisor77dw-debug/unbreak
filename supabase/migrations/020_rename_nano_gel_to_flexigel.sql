-- ============================================================
-- MIGRATION 020: Produktbezeichnung Nano-Gel -> Flexigel®
-- Auftrag: AW-20261105-DK-CLAUDE-UNBREAK-FLEXIGEL-UMSTELLUNG-001
-- Anlass: Umbenennung durch marvida GmbH & Co. KG (Schreiben 2026-09-30)
--
-- Aendert genau einen Artikel und nur name, description, badge_label.
-- ID, SKU, Preis, Status, Bilder sowie Bestellungen bleiben unveraendert.
-- Bricht ab, wenn der Datensatz nicht dem erwarteten Stand entspricht.
-- Rollback: supabase/rollback/020_rename_nano_gel_to_flexigel_rollback.sql
-- ============================================================

BEGIN;

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.products
  SET
    name = 'Flexigel®-Untersetzer',
    description = replace(description, 'Nano-Gel', 'Flexigel®'),
    badge_label = 'Flexigel®-Untersetzer'
  WHERE id = '4c4acbce-c4cd-4bf1-8111-6d8ca975e2f2'
    AND sku = 'Nana_Gel'
    AND name = 'Nano-Gel-Untersetzer'
    AND badge_label = 'Nano-Gel-Untersetzer';

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Erwartet genau 1 Datensatz, geaendert %', updated_rows;
  END IF;
END $$;

COMMIT;

-- Kontrolle
SELECT id, sku, name, badge_label, description, base_price_cents, active, status
FROM public.products
WHERE id = '4c4acbce-c4cd-4bf1-8111-6d8ca975e2f2';
