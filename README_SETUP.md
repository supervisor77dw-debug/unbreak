# 🚀 UNBREAK ONE - Database Setup Guide

## Übersicht

Dieses Projekt nutzt **automatische Datenbank-Initialisierung** ohne manuelle SQL-Schritte.

### Was ist enthalten?

- ✅ Automatische Tabellen-Erstellung (Migrations)
- ✅ Auto-Create Trigger für User-Profile
- ✅ Row Level Security (RLS) Policies
- ✅ Admin-Seed via Umgebungsvariable
- ✅ Health-Check Scripts
- ✅ API-Endpoint für Bootstrap

---

## 🎯 Schnellstart (Neues Projekt)

### 1. Umgebungsvariablen setzen

Erstelle `.env.local` im Root-Verzeichnis:

```bash
# Supabase Credentials (aus Supabase Dashboard)
SUPABASE_URL=https://deinprojekt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dein_service_role_key_hier
NEXT_PUBLIC_SUPABASE_URL=https://deinprojekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein_anon_key_hier

# Admin Seed (Email des ersten Admin-Users)
SEED_ADMIN_EMAIL=admin@deine-domain.de

# Optional: Bootstrap Secret (für API-Security)
BOOTSTRAP_SECRET=dein-geheimes-token-hier
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Datenbank initialisieren

**Option A: Via NPM Script (empfohlen)**

```bash
npm run db:bootstrap
```

**Option B: Via API Endpoint**

```bash
curl -X POST https://deine-domain.de/api/admin/bootstrap \
  -H "Authorization: Bearer DEIN_SERVICE_ROLE_KEY"
```

**Option C: Manuell via Supabase CLI**

```bash
# Falls Supabase CLI installiert ist
supabase db push
```

### 4. Verifizieren

```bash
npm run db:check
```

Erwartete Ausgabe:
```
✅ profiles
✅ products
👤 Admin user: ✅ exists
✅ DATABASE READY
```

---

## 📦 Migrations-System

### Struktur

```
supabase/
└── migrations/
    ├── 001_create_profiles.sql       # Profiles table + trigger
    ├── 002_profiles_rls_policies.sql # RLS für profiles
    ├── 003_products_rls_policies.sql # RLS für products
    └── 004_admin_seed_functions.sql  # Admin-Seed functions
```

### Wie funktioniert es?

1. **Auto-Profile Creation**
   - Wenn User sich registriert → Trigger erstellt automatisch `profiles` Eintrag
   - Default: `role = 'user'`

2. **Admin Promotion**
   - User mit Email = `SEED_ADMIN_EMAIL` wird automatisch zu Admin
   - Via Function: `promote_user_to_admin(email)`

3. **Row Level Security**
   - Profiles: User sieht nur eigenes Profil, Admin sieht alle
   - Products: Öffentlich lesen, nur Admin schreiben

---

## 👤 Admin-Benutzer einrichten

### Methode 1: Via SEED_ADMIN_EMAIL (empfohlen)

1. `.env.local` editieren:
   ```bash
   SEED_ADMIN_EMAIL=deine@email.de
   ```

2. User in Supabase Auth erstellen:
   - Supabase Dashboard → Authentication → Users → Add user
   - Email: `deine@email.de`
   - Password: beliebig
   - ✅ Auto Confirm User aktivieren

3. Bootstrap ausführen:
   ```bash
   npm run db:bootstrap
   ```

4. User wird automatisch zu Admin promoted! ✨

### Methode 2: Via SQL (Fallback)

Falls `SEED_ADMIN_EMAIL` nicht funktioniert:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'deine@email.de';
```

---

## 🔒 Sicherheit

### Row Level Security (RLS)

**Profiles Policies:**
- ✅ User kann eigenes Profil lesen
- ✅ Admin kann alle Profile lesen
- ✅ User kann eigenes Profil updaten (aber NICHT die Rolle)
- ❌ Normale User können keine Rollen ändern

**Products Policies:**
- ✅ Öffentlich: Aktive Produkte lesen
- ✅ Admin: Alle Produkte lesen/schreiben/löschen
- ❌ Normale User können keine Produkte erstellen

### Admin-Schutz in der App

```typescript
import { requireAdmin } from '@/lib/admin-middleware';

// In API Route:
const { isAdmin, error } = await requireAdmin(userId);
if (!isAdmin) {
  return res.status(403).json({ error });
}
```

---

## 🛠️ NPM Scripts

```bash
# Datenbank initialisieren (Migrations + Admin Seed)
npm run db:bootstrap

# Datenbank-Status prüfen
npm run db:check

# Alte Scripts (deprecated, manuell)
npm run db:setup    # ⚠️  Zeigt nur Hinweis
```

---

## 🔍 Troubleshooting

### Problem: "Table 'profiles' does not exist"

**Lösung:**
```bash
npm run db:bootstrap
```

### Problem: "Invalid API Key"

**Ursache:** Falscher Supabase Key in `login.html` / `admin.html`

**Lösung:**
- Öffne `.env.local`
- Kopiere `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Update in `public/login.html` und `public/admin.html`

### Problem: "No admin user found"

**Lösung:**
1. `.env.local` prüfen: `SEED_ADMIN_EMAIL` gesetzt?
2. User in Supabase Auth erstellt?
3. Bootstrap nochmal ausführen:
   ```bash
   npm run db:bootstrap
   ```

### Problem: "Unauthorized beim Produktanlegen"

**Ursache:** User ist kein Admin

**Lösung:**
```sql
-- Prüfen:
SELECT * FROM profiles WHERE email = 'deine@email.de';

-- Fixen:
UPDATE profiles SET role = 'admin' WHERE email = 'deine@email.de';
```

---

## 📊 Health-Check

Die App prüft beim Start automatisch die Datenbank:

```typescript
import { logHealthStatus } from '@/lib/health-check';

// In _app.tsx oder middleware:
await logHealthStatus();
```

**Ausgabe bei Fehler:**
```
❌ DATABASE NOT INITIALIZED
Missing tables: profiles, products

🔧 To fix, run migrations:
   1. Via API: POST /api/admin/bootstrap
   2. Via SQL: Execute files in supabase/migrations/
   3. Via Supabase CLI: supabase db push
```

---

## 🚢 Production Deployment (Vercel)

### 1. Environment Variables in Vercel setzen

```
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SEED_ADMIN_EMAIL=admin@deine-domain.de
BOOTSTRAP_SECRET=dein-geheimes-token
```

### 2. Bootstrap nach erstem Deploy

**Option A: Via Vercel Functions (nach Deploy)**

```bash
curl -X POST https://deine-domain.de/api/admin/bootstrap \
  -H "Authorization: Bearer BOOTSTRAP_SECRET"
```

**Option B: Via Supabase Dashboard**

- SQL Editor öffnen
- Alle Files in `supabase/migrations/` nacheinander ausführen

### 3. Admin-User erstellen

- Supabase Dashboard → Authentication → Users → Add user
- Email = `SEED_ADMIN_EMAIL`
- Bootstrap API nochmal aufrufen (promoted zu Admin)

---

## 📁 Dateistruktur

```
unbreak-one/
├── supabase/
│   └── migrations/
│       ├── 001_create_profiles.sql
│       ├── 002_profiles_rls_policies.sql
│       ├── 003_products_rls_policies.sql
│       └── 004_admin_seed_functions.sql
│
├── lib/
│   ├── supabase-bootstrap.ts    # Migration runner
│   ├── admin-middleware.ts      # Admin check helpers
│   └── health-check.ts          # DB verification
│
├── scripts/
│   ├── bootstrap-db.ts          # CLI bootstrap
│   └── check-db.ts              # CLI health check
│
├── pages/api/admin/
│   └── bootstrap.ts             # API endpoint
│
└── public/
    ├── login.html               # Login page
    └── admin.html               # Admin dashboard
```

---

## ✅ Checkliste (Fresh Install)

- [ ] `.env.local` erstellt mit allen Keys
- [ ] `SEED_ADMIN_EMAIL` gesetzt
- [ ] `npm install` ausgeführt
- [ ] `npm run db:bootstrap` erfolgreich
- [ ] `npm run db:check` zeigt ✅
- [ ] Admin-User in Supabase Auth erstellt
- [ ] Login unter `/login.html` funktioniert
- [ ] Admin-Dashboard unter `/admin.html` erreichbar
- [ ] Produkte können angelegt werden

---

## 🆘 Support

Bei Problemen:

1. **Logs prüfen:** `npm run db:check`
2. **Supabase Logs:** Dashboard → Logs
3. **Browser Console:** F12 in `/login.html` oder `/admin.html`
4. **Migrations prüfen:** Sind alle Files in `supabase/migrations/` vorhanden?

---

## 🎓 Best Practices

### DO ✅
- Nutze `npm run db:bootstrap` für Setup
- Verwende `SEED_ADMIN_EMAIL` für ersten Admin
- Prüfe Logs bei Fehlern
- Führe `npm run db:check` nach Änderungen aus

### DON'T ❌
- Supabase Dashboard SQL Editor für manuelle Tabellen-Erstellung
- Admin-Rolle direkt aus Frontend setzen (nur via Service Role)
- Service Role Key im Frontend verwenden
- `.env.local` in Git committen

---

**Version:** 1.0  
**Letzte Aktualisierung:** 28. Dezember 2025
