# 🚀 UNBREAK-ONE: Vercel Deployment Status

## ✅ Git Push erfolgreich
Commit: `c44132f`  
Branch: `master`  
Remote: https://github.com/supervisor77dw-debug/unbreak.git

---

## 📦 Deployment wird gebaut...

**Vercel Dashboard:** https://vercel.com/dashboard

**Erwartete URL nach Deployment:**
- Production: https://unbreak-one.vercel.app
- Preview: https://unbreak-one-[hash].vercel.app

---

## ⚠️ WICHTIG: Vor dem Test

### 1. Supabase Setup (EINMALIG - JETZT AUSFÜHREN)

**Gehe zu:** https://supabase.com/dashboard/project/qnzsdytdghfukrqpscsg/sql/new

**Führe aus:**

```sql
-- ============================================================
-- Webhook Logs Table - Track Stripe webhook events
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_id TEXT,
  stripe_session_id TEXT,
  status TEXT NOT NULL, -- 'success', 'error', 'skipped'
  error_message TEXT,
  order_id UUID REFERENCES simple_orders(id),
  rows_affected INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_session_id ON webhook_logs(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);

-- RLS: Allow service_role to insert logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert webhook logs"
ON webhook_logs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Authenticated users can read webhook logs"
ON webhook_logs FOR SELECT
TO authenticated
USING (true);

-- Grant permissions
GRANT SELECT ON webhook_logs TO authenticated;
GRANT ALL ON webhook_logs TO service_role;
```

**Klicke:** "Run" ▶️

**Verifiziere:**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'webhook_logs'
);
```
→ Sollte `true` zurückgeben

---

### 2. Warte auf Vercel Deployment

**Check Status:**
1. Gehe zu: https://vercel.com/dashboard
2. Projekt: **UNBREAK-ONE**
3. Tab: **Deployments**
4. Warte bis Status: ✅ **Ready**

---

## 🧪 TEST STARTEN

**Sobald Deployment Ready:**

1. **Admin Debug öffnen:**  
   https://unbreak-one.vercel.app/admin/debug

2. **Folge Test-Guide:**  
   Siehe `VERCEL-CART-TEST.md` für vollständige Anleitung

3. **Quick Test:**
   - Shop öffnen: https://unbreak-one.vercel.app/shop
   - 2 Produkte in Warenkorb
   - Menge ändern (1x und 2x)
   - Checkout mit `4242 4242 4242 4242`
   - Admin Debug prüfen: Order paid? Items JSONB korrekt?

---

## 🎯 Erfolgs-Kriterien

✅ **Deployment erfolgreich wenn:**
- [ ] Admin Debug lädt ohne Fehler
- [ ] Environment Check: Alle ✅
- [ ] Cart funktioniert (Produkte hinzufügen)
- [ ] Checkout erstellt Stripe Session mit 2 Line Items
- [ ] Nach Zahlung: Order Status = `paid`
- [ ] Order Items = JSONB Array mit 2 Objekten
- [ ] Webhook Logs zeigen `success` Status
- [ ] Vercel Logs zeigen `[WEBHOOK HIT] POST`

---

## 🆘 Falls Fehler

**"Invalid API key" in Admin Debug:**
→ Vercel ENV Variables prüfen (siehe VERCEL-CART-TEST.md Troubleshooting)

**"Table webhook_logs doesn't exist":**
→ Supabase SQL oben ausführen

**Order bleibt 'pending':**
→ Admin Debug → Webhook Logs → Error Message lesen
→ Stripe Dashboard → Webhooks → Recent Deliveries prüfen
