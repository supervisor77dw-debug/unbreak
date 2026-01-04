# ENV & KEY SYSTEM - FINAL SETUP GUIDE

**Datum:** 4. Januar 2026  
**Status:** ✅ STANDARDISIERT auf SUPABASE SB_ KEY FORMAT

---

## 🎯 ZIEL: Vercel ↔ Lokal 1:1 Übereinstimmung

### ✅ VERWENDETES KEY FORMAT

**NUR SB_ PREFIX KEYS:**
```bash
# Supabase Keys (von Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

**WICHTIG:**
- ❌ KEINE Legacy JWT Keys mehr (eyJ...)
- ✅ NUR sb_publishable_* und sb_secret_*
- ✅ Keys direkt aus Supabase Dashboard kopieren

#### A) Frontend/Client (Browser-sichtbar)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_daOPzWvSvv7WFMGmoFkPkQ_9I26lzBS
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51Siyji...
```

**Wichtig:**
- `NEXT_PUBLIC_*` Variablen sind im Browser verfügbar
- NIE `sb_secret_*` in `NEXT_PUBLIC_*` Variablen!
- Anon Key ist öffentlich safe (Row Level Security schützt Daten)

#### B) Server-Only (API Routes, Scripts, Webhooks)
```bash
SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_j9BVv-3n4lzRyXjFKgilBw_VPlqXwut
STRIPE_SECRET_KEY=sk_test_51Siyji...
STRIPE_WEBHOOK_SECRET=whsec_37IH7f5i...
```

**Wichtig:**
- `SUPABASE_SERVICE_ROLE_KEY` bypassed RLS → NIEMALS im Browser!
- Beide `SUPABASE_URL` nötig: Scripts nutzen `SUPABASE_URL`, Next.js verwendet `NEXT_PUBLIC_SUPABASE_URL`

#### C) Auth & Database
```bash
NEXTAUTH_SECRET=uE2cWwmLfCICyk3S1yak+0/wDfGdzspeCwhrwnZswKs=
NEXTAUTH_URL=https://unbreak-one.vercel.app
DATABASE_URL=postgresql://postgres.qnzsdytdghfukrqpscsg:...@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.qnzsdytdghfukrqpscsg:...@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

---

## 🔑 SUPABASE KEY FORMAT (SB_ ONLY)

### Aktuell in Verwendung (RICHTIG):
```bash
# Von Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_daOPzWvSvv7WFMGmoFkPkQ_9I26lzBS
SUPABASE_SERVICE_ROLE_KEY=sb_secret_j9BVv-3n4lzRyXjFKgilBw_VPlqXwut
```

**Validierung:**
- ✅ Anon Key startet mit `sb_publishable_`
- ✅ Service Key startet mit `sb_secret_`
- ❌ KEINE Längenchecks (kann 40-200+ chars sein)

---

## 📋 SETUP SCHRITTE

### 1. Vercel Environment Variables Setup

```bash
# Vercel Dashboard → unbreak-one → Settings → Environment Variables
# Production Environment - COPY THESE VALUES:

NEXT_PUBLIC_SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...  # Copy from Vercel
SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...  # Copy from Vercel

STRIPE_SECRET_KEY=sk_test_...  # Copy from Vercel
STRIPE_WEBHOOK_SECRET=whsec_...  # Copy from Vercel
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Copy from Vercel

# ... (rest from Vercel)
```

### 2. Lokale .env.local (✅ MANUELL AUSFÜLLEN)

**Verwende Template:**
```bash
# Kopiere Datei: docs/ENV_TEMPLATE.local.txt → .env.local
# Fülle ALLE Werte aus Vercel Dashboard ein
```

**Oder erstelle .env.local mit:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...  # COPY FROM VERCEL
SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...  # COPY FROM VERCEL

STRIPE_SECRET_KEY=sk_test_...  # COPY FROM VERCEL
STRIPE_WEBHOOK_SECRET=whsec_...  # COPY FROM VERCEL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # COPY FROM VERCEL

# ... (rest kopiert von Vercel)
```

### 3. Code Updates (✅ BEREITS ERLEDIGT)
Folgende Scripts wurden angepasst:
- ✅ `scripts/test-supabase-connection.js` - Neue Key-Validierung
- ✅ `scripts/backfill-customers.js` - Fallback für `SUPABASE_URL`
- ✅ `scripts/check-customers.js` - Fallback für `SUPABASE_URL`
- ✅ `scripts/verify-schema.js` - Fallback für `SUPABASE_URL`

**Änderungen:**
- Entfernt: `if (key.length < 100)` Checks
- Entfernt: `"must start with eyJ"` Validierung
- Hinzugefügt: `sb_publishable_*` und `sb_secret_*` Erkennung
- Hinzugefügt: Fallback `SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL`

---

## ✅ VERIFICATION TESTS

### Test 0: ENV Health Check (NEU!)
```bash
node scripts/print-env-health.js
```

**Erwartete Ausgabe:**
```
🔍 Environment Variables Health Check

📦 Supabase:
  ✅ NEXT_PUBLIC_SUPABASE_URL
     Status: OK (https:***)
     Scope: 🌍 PUBLIC
  ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
     Status: OK (sb_publishable_***)
     Scope: 🌍 PUBLIC
  ✅ SUPABASE_SERVICE_ROLE_KEY
     Status: OK (sb_secret_***)
     Scope: 🔒 SECRET

🔐 Security Check:
  ✅ No secrets in NEXT_PUBLIC_* variables

📋 Supabase Key Format:
  ✅ Anon key: sb_publishable_* (NEW FORMAT)
  ✅ Service key: sb_secret_* (NEW FORMAT)

📊 Summary:
  Total variables: 16
  Missing: 0
  Prefix issues: 0

✅ All environment variables are configured correctly!
```

### Test 1: Connection Test
```bash
node scripts/test-supabase-connection.js
```

**Erwartete Ausgabe:**
```
🔍 Testing Supabase Connection...

Environment Check:
  SUPABASE_URL: ✅ Set
  SUPABASE_SERVICE_ROLE_KEY: ✅ Set
  STRIPE_SECRET_KEY: ✅ Set

🔑 Key Validation:
  URL: https://qnzsdytdghfukrqpscsg.supabase.co
  Service Key: sb_secret_j9BV***
  ✅ Format: sb_secret_* (correct)

Attempting connection...
✅ Connection successful!
   Found X sample order(s)
✅ customer_id column exists
   Ready to run backfill!
```

### Test 2: Customer Backfill
```bash
node scripts/backfill-customers.js
```

**Erwartete Ausgabe:**
```
🚀 Starting customer data backfill...

Found X orders without customer data
Processing orders in batches...

✅ Batch 1/Y complete
...
✅ Backfill complete!

Summary:
  - Total orders processed: X
  - Customers created: Y
  - Customers updated: Z
  - Errors: 0
```

### Test 3: Database Verification
```sql
-- In Supabase SQL Editor:

-- Count customers
SELECT count(*) as total_customers FROM public.customers;

-- Count orders with customer links
SELECT 
  count(*) as total_orders,
  count(customer_id) as with_customer_id,
  count(customer_email) as with_email,
  count(stripe_customer_id) as with_stripe_id
FROM public.simple_orders;
```

### Test 4: Admin Panel Check
1. Öffne: https://unbreak-one.vercel.app/admin/customers
2. Erwartung: Liste aller Customers angezeigt
3. Klicke auf Customer → Detail-Ansicht funktioniert
4. Öffne: https://unbreak-one.vercel.app/admin/orders
5. Erwartung: Orders zeigen Customer Email/Name

---

## 🔐 SICHERHEITS-CHECKLISTE

### ✅ Vercel (Production)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ist **NICHT** in `NEXT_PUBLIC_*` Variablen
- [ ] Service Role Key nur in `Environment Variables` (nicht im Code)
- [ ] `.env.local` **NICHT** in Git committed

### ✅ Lokal (Development)
- [ ] `.env.local` in `.gitignore` eingetragen
- [ ] Identische Keys wie Vercel verwendet
- [ ] Keine Keys in Code hard-coded

### ✅ Code
- [ ] Alle `createClient()` Calls verwenden env variables
- [ ] Server-only code verwendet `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Client code verwendet `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🚀 DEPLOYMENT WORKFLOW

### Nach ENV Updates in Vercel:
```bash
# 1. Vercel Dashboard → Redeploy ausgelöst
# 2. Neue Build mit neuen ENV vars

# 3. Lokal testen (mit identischen ENV vars):
node scripts/test-supabase-connection.js
npm run dev
# Teste Admin → Customers
# Teste Configurator → Checkout

# 4. Bei Erfolg: Commit Code (OHNE .env.local!)
git add .
git commit -m "ENV: Standardisiert auf neue Supabase Key System"
git push origin master
```

### Troubleshooting:
```bash
# Connection failed?
→ Prüfe: Vercel ENV vars kopiert nach .env.local
→ Prüfe: Keys starten mit sb_secret_ / sb_publishable_
→ Prüfe: .env.local wird geladen (dotenv injecting msg)

# Backfill failed with "column does not exist"?
→ Run: database/RUN-THIS-NOW-complete-simple-orders-fix.sql in Supabase
→ Dann: node scripts/backfill-customers.js

# Customers page empty?
→ Check: /api/admin/customers route existiert
→ Check: RLS policies erlauben SELECT für authenticated users
→ Run: node scripts/backfill-customers.js
```

---

## 📚 REFERENZ

### ENV Variable Namenskonventionen:
| Variable | Scope | Beispiel |
|----------|-------|----------|
| `NEXT_PUBLIC_*` | Client + Server | `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_*` | Server-only | `SUPABASE_SERVICE_ROLE_KEY` |
| `*_SECRET*` | Server-only | `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY` |

### Supabase Client Initialisierung:
```javascript
// Client-Side (Browser)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Server-Side (API Routes, Scripts)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

---

## ✅ AKZEPTANZKRITERIEN

- [x] `.env.local` enthält identische Werte wie Vercel
- [x] Keine Legacy Key Validierung (200+ chars, eyJ...) mehr im Code
- [x] Scripts verwenden `sb_secret_*` und `sb_publishable_*` Keys
- [ ] `node scripts/test-supabase-connection.js` erfolgreich
- [ ] `node scripts/backfill-customers.js` synct Customers
- [ ] Admin → Customers zeigt Einträge
- [ ] Neue Orders erstellen automatisch Customer-Link

---

**Status:** 🔄 Code Updates complete, ready for testing
**Next Steps:** Run verification tests
