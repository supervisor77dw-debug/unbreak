-- Nur lesend: Testbestellungen für eine spätere kontrollierte Bereinigung
-- (AW-20261105-DK-CLAUDE-UNBREAK-SHOP-ABSCHLUSS-001).
-- Gibt keine Kundendaten aus. Löschen ist ein eigener Freigabeschritt.

SELECT
  left(id::text, 8) AS id,
  order_number,
  status,
  email_status,
  fulfillment_status,
  total_amount_cents,
  created_at::date AS angelegt
FROM public.simple_orders
WHERE stripe_session_id LIKE 'cs_test%'
ORDER BY created_at DESC;
