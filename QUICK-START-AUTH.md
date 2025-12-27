# UNBREAK ONE - Auth System Quick Start

## 🚀 Installation (5 Minuten)

### 1. Environment Variables

Erstelle `.env.local` im Root-Verzeichnis:

```bash
# Supabase (Public - Safe for Client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key

# Supabase (Server - NEVER expose!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key

# Stripe (Existing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Wo finde ich die Keys?**
- Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

### 2. Database Setup

```bash
# Via Supabase Dashboard:
1. Gehe zu: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
2. Klicke "New Query" (SQL Editor)
3. Kopiere kompletten Inhalt von: database/auth-setup.sql
4. Klicke "Run" (oder Ctrl+Enter)
5. Warte auf "Success" (grüner Haken)
```

**Verification:**
```sql
-- Run this to check if setup worked:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'orders', 'products');

-- Expected: All should have rowsecurity = true
```

### 3. Inject Environment Variables

```bash
npm run inject-env
```

**Was passiert?**
- Ersetzt `YOUR_SUPABASE_URL` mit echten Werten in allen HTML-Dateien
- Behandelt: login.html, account.html, ops.html, admin.html, header.js

### 4. Ersten Admin erstellen

**Option A: Via Dashboard (empfohlen)**
1. Erstelle ersten User: Gehe zu Checkout und kaufe etwas (oder manuell via Supabase Auth)
2. Gehe zu: Table Editor → profiles
3. Finde deine E-Mail, editiere `role` → `admin`

**Option B: Via SQL**
```sql
-- Nach erstem Signup via Checkout oder Auth
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

### 5. Test

```bash
npm run dev
```

**Test-URLs:**
- http://localhost:3000/login.html - Login Page
- http://localhost:3000/account.html - Customer Portal
- http://localhost:3000/ops.html - Staff Portal
- http://localhost:3000/admin.html - Admin Portal

**Test-Flow:**
1. Login mit Admin-Account
2. Sollte automatisch zu `/admin.html` redirecten
3. Teste User-Rollenverwaltung
4. Teste Produkt-Edit

---

## ✅ Checklist

- [ ] `.env.local` erstellt mit allen Keys
- [ ] `database/auth-setup.sql` in Supabase ausgeführt
- [ ] Verification Query zeigt `rowsecurity = true`
- [ ] `npm run inject-env` ausgeführt
- [ ] Erster Admin-User erstellt
- [ ] Login funktioniert
- [ ] Redirect zu `/admin.html` funktioniert
- [ ] Rollenverwaltung funktioniert

---

## 🎯 Quick Commands

```bash
# Development
npm run dev                 # Start Next.js dev server

# Build
npm run build               # Inject env + build for production
npm run inject-env          # Only inject environment variables

# Testing
npm test                    # Run Playwright E2E tests
npm run test:ui             # Run tests with UI
npm run serve               # Serve static files (Python)

# Database
npm run db:setup            # Shows instructions for SQL setup
```

---

## 📁 Wichtige Dateien

```
database/auth-setup.sql     → SQL Setup (run in Supabase)
lib/auth.js                 → Client-side auth helpers
lib/auth-server.js          → Server-side auth (service_role)
public/login.html           → Login page
public/account.html         → Customer portal
public/ops.html             → Staff portal
public/admin.html           → Admin portal
pages/api/admin/set-role.js → Admin API: Set user role
pages/api/admin/products/update.js → Admin API: Update product
scripts/inject-env.js       → Environment injection script
AUTH-SETUP.md               → Vollständige Dokumentation
```

---

## 🆘 Troubleshooting

**Problem: "Missing Supabase environment variables"**
→ Check `.env.local` exists and has all required keys

**Problem: RLS Policy Error**
→ Run `database/auth-setup.sql` again in Supabase Dashboard

**Problem: Login redirect loop**
→ Clear browser cookies/storage, check console for errors

**Problem: "Cannot read properties of undefined (reading 'createClient')"**
→ Supabase script not loaded yet, check `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`

**Problem: Products not visible in Admin Portal**
→ Check RLS policies exist for products table

---

## 🎓 Nächste Schritte

1. **Produktions-Deployment:**
   - Vercel: Setze Environment Variables in Dashboard
   - Auto-run: `npm run build` (includes inject-env)

2. **Test-Users erstellen:**
   ```sql
   UPDATE profiles SET role = 'staff' WHERE email = 'staff@test.com';
   UPDATE profiles SET role = 'customer' WHERE email = 'customer@test.com';
   ```

3. **Email Verification aktivieren:**
   - Supabase Dashboard → Authentication → Email Templates
   - Enable "Confirm signup"

4. **Weitere Features:**
   - Password Reset Page
   - User Deletion (Admin)
   - Audit Logs

---

**Vollständige Dokumentation:** [AUTH-SETUP.md](AUTH-SETUP.md)
