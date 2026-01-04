# 🚨 FINAL SETUP - COPY-PASTE GUIDE

## Status
- ✅ Code aktualisiert (sb_ key system only)
- ✅ Scripts bereit (print-env-health.js, test-supabase-connection.js)
- ❌ **Connection schlägt fehl** - Keys müssen von Vercel kopiert werden

---

## 🎯 PROBLEM & LÖSUNG

**Problem:**
Die Keys in .env.local sind entweder:
1. Zu kurz / truncated
2. Ungültig
3. Nicht synchron mit Vercel

**Lösung:**
Kopiere **ALLE** ENV Variables 1:1 von Vercel nach .env.local

---

## 📋 SCHRITT-FÜR-SCHRITT ANLEITUNG

### 1. Vercel Dashboard öffnen

https://vercel.com/supervisor77dw-debugs-projects/unbreak-one/settings/environment-variables

### 2. Werte kopieren

Für **JEDE** Variable:
1. Klicke auf **"..."** (3 Punkte rechts)
2. Wähle **"Copy Value"**
3. Paste in .env.local

**Mindestens diese kopieren:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
DATABASE_URL
DIRECT_URL
RESEND_API_KEY
RESEND_FROM
SHOP_OWNER_EMAIL
ADMIN_SEED_EMAIL
ADMIN_SEED_PASSWORD
```

### 3. .env.local erstellen

**Option A: Template verwenden**
```bash
# Windows PowerShell:
Copy-Item docs\ENV_TEMPLATE.local.txt .env.local

# Dann .env.local öffnen und Werte von Vercel einfügen
```

**Option B: Direkt erstellen**
```bash
# Erstelle .env.local im Root
# Paste alle Werte von Vercel
```

**Beispiel .env.local:**
```bash
# Supabase (COPY FROM VERCEL!)
NEXT_PUBLIC_SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_[PASTE COMPLETE VALUE FROM VERCEL]
SUPABASE_URL=https://qnzsdytdghfukrqpscsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_[PASTE COMPLETE VALUE FROM VERCEL]

# Stripe (COPY FROM VERCEL!)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_[PASTE FROM VERCEL]
STRIPE_SECRET_KEY=sk_test_[PASTE FROM VERCEL]
STRIPE_WEBHOOK_SECRET=whsec_[PASTE FROM VERCEL]

# Auth (COPY FROM VERCEL!)
NEXTAUTH_SECRET=[PASTE FROM VERCEL]
NEXTAUTH_URL=http://localhost:3000

# Database (COPY FROM VERCEL!)
DATABASE_URL=[PASTE FROM VERCEL]
DIRECT_URL=[PASTE FROM VERCEL]

# Email (COPY FROM VERCEL!)
RESEND_API_KEY=[PASTE FROM VERCEL]
RESEND_FROM=[PASTE FROM VERCEL]
SHOP_OWNER_EMAIL=[PASTE FROM VERCEL]

# Admin (COPY FROM VERCEL!)
ADMIN_SEED_EMAIL=[PASTE FROM VERCEL]
ADMIN_SEED_PASSWORD=[PASTE FROM VERCEL]
```

### 4. Validierung

```bash
# Test 1: ENV Health
node scripts/print-env-health.js

# Erwartung:
# ✅ All environment variables are configured correctly!
```

```bash
# Test 2: Supabase Connection
node scripts/test-supabase-connection.js

# Erwartung:
# ✅ Connection successful!
# ✅ customer_id column exists
```

### 5. Migration (in Supabase Dashboard)

1. Öffne: https://supabase.com/dashboard/project/qnzsdytdghfukrqpscsg/sql/new
2. Kopiere Inhalt von: `database/RUN-THIS-NOW-complete-simple-orders-fix.sql`
3. Paste in SQL Editor
4. Klick **RUN**
5. Erwartung: Siehe "Added" Meldungen oder "already exists"

### 6. Backfill

```bash
node scripts/backfill-customers.js

# Erwartung:
# ✅ Backfill complete!
#    Synced: X customers
```

---

## ✅ SUCCESS CRITERIA

- [ ] `node scripts/print-env-health.js` zeigt alle ✅
- [ ] `node scripts/test-supabase-connection.js` → Connection successful
- [ ] Migration ausgeführt (customer_id exists)
- [ ] `node scripts/backfill-customers.js` → Customers synced
- [ ] Admin → Customers zeigt Einträge

---

## 🔍 TROUBLESHOOTING

### "ECONNRESET" oder "fetch failed"
→ Keys sind falsch oder unvollständig
→ **LÖSUNG:** Kopiere KOMPLETTE Keys von Vercel (nicht verkürzt!)

### "MISSING" in print-env-health.js
→ Variable nicht in .env.local gesetzt
→ **LÖSUNG:** Kopiere von Vercel Dashboard

### "WRONG PREFIX"
→ Key hat falsches Format
→ **LÖSUNG:** Stelle sicher sb_publishable_* / sb_secret_* (oder eyJ...)

### "column does not exist"
→ Migration nicht ausgeführt
→ **LÖSUNG:** Run database/RUN-THIS-NOW-complete-simple-orders-fix.sql

---

## 📝 WICHTIG

1. **NIEMALS .env.local in Git committen!**
2. **Keys sind IDENTISCH zu Vercel** (1:1 copy)
3. **KOMPLETTE Keys kopieren** (nicht verkürzen)
4. **sb_secret_* NIE in NEXT_PUBLIC_*** Variablen

---

## Quick Commands

```bash
# 1. Copy template
cp docs/ENV_TEMPLATE.local.txt .env.local

# 2. Edit .env.local and paste values from Vercel

# 3. Validate
node scripts/print-env-health.js

# 4. Test connection
node scripts/test-supabase-connection.js

# 5. Run migration in Supabase SQL Editor
# (database/RUN-THIS-NOW-complete-simple-orders-fix.sql)

# 6. Backfill
node scripts/backfill-customers.js

# 7. Verify
node scripts/check-customers.js
```

---

**Status:** 🔄 WAITING FOR VERCEL KEYS TO BE COPIED  
**Action Required:** Copy ALL env values from Vercel → .env.local
