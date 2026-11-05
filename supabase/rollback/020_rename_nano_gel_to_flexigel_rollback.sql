-- Rollback zu Migration 020 (AW-20261105-DK-CLAUDE-UNBREAK-FLEXIGEL-UMSTELLUNG-001)
-- Stellt die vorherigen Werte von name, description und badge_label wieder her.

BEGIN;

DO $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.products
  SET
    name = 'Nano-Gel-Untersetzer',
    description = replace(description, 'Flexigel®', 'Nano-Gel'),
    badge_label = 'Nano-Gel-Untersetzer'
  WHERE id = '4c4acbce-c4cd-4bf1-8111-6d8ca975e2f2'
    AND sku = 'Nana_Gel'
    AND name = 'Flexigel®-Untersetzer';

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Erwartet genau 1 Datensatz, geaendert %', updated_rows;
  END IF;
END $$;

COMMIT;
