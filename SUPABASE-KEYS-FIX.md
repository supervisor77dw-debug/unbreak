# ⚠️ SUPABASE KEYS - COPY FROM VERCEL GUIDE

## Problem
Lokale .env.local hat keine oder falsche Supabase Keys.

## ✅ LÖSUNG: Kopiere Keys von Vercel Dashboard

### Schritt 1: Vercel Dashboard öffnen
1. Gehe zu: https://vercel.com/supervisor77dw-debugs-projects/unbreak-one
2. Klicke: **Settings** → **Environment Variables**

### Schritt 2: Werte kopieren

Kopiere folgende Variablen (klicke auf ... → Copy Value):

```bash
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
# ... alle weiteren
```

### Schritt 3: .env.local erstellen/aktualisieren

**Option A: Template verwenden**
```bash
# 1. Kopiere Template
cp docs/ENV_TEMPLATE.local.txt .env.local

# 2. Öffne .env.local
# 3. Paste Werte von Vercel ein
```

**Option B: Manuell erstellen**
```bash
# Erstelle .env.local im Root-Verzeichnis
# Paste alle Werte von Vercel
```

### Schritt 4: Key Format prüfen

**RICHTIG (sb_ prefix):**
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

**FALSCH:**
```bash
# Zu kurz / truncated
SUPABASE_SERVICE_ROLE_KEY=sb_secret_j9BVv-3n4l  # NUR 25 chars

# Legacy (nicht mehr empfohlen)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # JWT format
```

### Schritt 5: Validierung

```bash
# Prüfe ENV Health
node scripts/print-env-health.js

# Test Verbindung
node scripts/test-supabase-connection.js
```

**Erwartete Ausgabe:**
```
✅ All environment variables are configured correctly!
✅ Connection successful!
```

### Schritt 6: Migration + Backfill

**1. Migration ausführen (in Supabase SQL Editor):**
```sql
-- Kopiere Inhalt von: database/RUN-THIS-NOW-complete-simple-orders-fix.sql
-- Paste in Supabase Dashboard → SQL Editor → RUN
```

**2. Backfill:**
```bash
node scripts/backfill-customers.js
```

---

## 🔍 Troubleshooting

### Error: "MISSING" in print-env-health.js
→ Variable nicht in .env.local gesetzt
→ Kopiere Wert von Vercel Dashboard

### Error: "WRONG PREFIX" 
→ Key hat falsches Format
→ Stelle sicher: sb_publishable_* und sb_secret_*

### Error: "ECONNRESET" oder "fetch failed"
→ Keys sind ungültig oder truncated
→ Kopiere KOMPLETTE Keys von Vercel (inkl. ... am Ende)

### Error: "column customer_id does not exist"
→ Migration noch nicht ausgeführt
→ Run: database/RUN-THIS-NOW-complete-simple-orders-fix.sql

---

## 📋 CHECKLISTE

- [ ] Vercel Dashboard geöffnet
- [ ] ENV Variables kopiert (alle!)
- [ ] .env.local erstellt/aktualisiert
- [ ] Keys starten mit sb_publishable_/sb_secret_
- [ ] `node scripts/print-env-health.js` → ✅ ALL OK
- [ ] `node scripts/test-supabase-connection.js` → ✅ SUCCESS
- [ ] Migration ausgeführt (RUN-THIS-NOW-complete-simple-orders-fix.sql)
- [ ] `node scripts/backfill-customers.js` → ✅ Customers synced

---

**Quick Start:**
```bash
# 1. Copy template
cp docs/ENV_TEMPLATE.local.txt .env.local

# 2. Fill values from Vercel Dashboard

# 3. Validate
node scripts/print-env-health.js
node scripts/test-supabase-connection.js

# 4. Done!
```
