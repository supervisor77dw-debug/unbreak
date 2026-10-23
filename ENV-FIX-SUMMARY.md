# ENV VARIABLE FIX - WICHTIG!

## ✅ GEFIXTE DATEIEN

Die folgenden Dateien verwendeten **falsche ENV-Namen** im Server-Side Code:

### 1. lib/auth-server.js
- **Vorher:** `process.env.NEXT_PUBLIC_SUPABASE_URL` ❌
- **Jetzt:** `process.env.SUPABASE_URL` ✅

### 2. pages/api/checkout/bundle.js
- **Vorher:** `process.env.NEXT_PUBLIC_SUPABASE_URL` ❌
- **Jetzt:** `process.env.SUPABASE_URL` ✅

### 3. pages/api/checkout/preset.js
- **Vorher:** `process.env.NEXT_PUBLIC_SUPABASE_URL` ❌
- **Jetzt:** `process.env.SUPABASE_URL` ✅

### 4. pages/api/checkout/standard.js
- **Vorher:** `process.env.NEXT_PUBLIC_SUPABASE_URL` ❌
- **Jetzt:** `process.env.SUPABASE_URL` ✅

---

## 📋 VERCEL ENV VARIABLES CHECKLISTE

Gehe zu: https://vercel.com/supervisor77dw-debugs-projects/unbreak-one/settings/environment-variables

**Stelle sicher, dass EXAKT diese 4 Variables gesetzt sind:**

### ✅ Client-Side (NEXT_PUBLIC_*)
```
NEXT_PUBLIC_SUPABASE_URL = https://qnzsdytdghfukrqpscsg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuenNkeXRkZ2hmdWtycXBzY3NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ0OTg3MjksImV4cCI6MjA0MDA3NDcyOX0.fWBwA-CU-DzBdRXf3uSnRQQbGpxZH2r5FnxjRqrRAUs
```

### ✅ Server-Side
```
SUPABASE_URL = https://qnzsdytdghfukrqpscsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY = <SUPABASE_SERVICE_ROLE_KEY_REDACTED>
```

**WICHTIG:**
- Environment: Alle 3 auswählen (Production, Preview, Development)
- Nach dem Setzen: **Redeploy mit "Clear Build Cache"**

---

## 🔍 ARCHITEKTUR (FINAL)

### Client-Side (Browser)
**Dateien:**
- `pages/admin/products.js`
- `pages/my-products.js`
- `pages/shop.js`
- `lib/auth.js`

**Verwendet:**
- ✅ `process.env.NEXT_PUBLIC_SUPABASE_URL`
- ✅ `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`

**RLS:** Vollständig aktiv, User sieht nur eigene Daten

---

### Server-Side (API Routes)
**Dateien:**
- `lib/auth-server.js`
- `lib/supabase.js` (getSupabaseAdmin)
- `pages/api/checkout/*.js`
- `pages/api/admin/*.js`

**Verwendet:**
- ✅ `process.env.SUPABASE_URL`
- ✅ `process.env.SUPABASE_SERVICE_ROLE_KEY`

**Sicherheit:** Service Role Key bypassed RLS (nur für Admin-Actions)

---

## ✅ NÄCHSTE SCHRITTE

1. **Commit & Push:**
   ```bash
   git add .
   git commit -m "Fix: Use correct ENV variables (SUPABASE_URL in server-side code)"
   git push
   ```

2. **Vercel ENV prüfen:**
   - Alle 4 Variables gesetzt?
   - Alle 3 Environments ausgewählt?

3. **Redeploy:**
   - In Vercel: Deployments → Latest → ... → Redeploy
   - ✅ "Clear Build Cache" aktivieren

4. **Test:**
   - `/login.html` → Login als `user@test.com`
   - `/my-products` → Sollte funktionieren
   - `/admin/products` → Login als `admin@test.com`

---

## 🐛 WENN IMMER NOCH "Invalid API Key":

**Debug-Checklist:**
- [ ] Vercel ENV Variables gesetzt?
- [ ] Alle 3 Environments ausgewählt?
- [ ] Build Cache gecleared?
- [ ] Neue Deployment-URL testen (nicht alte Preview)?
- [ ] Browser DevTools → Network → Request Headers → env vars da?

**Dann:** Zeig mir den genauen Fehler aus Browser Console!
