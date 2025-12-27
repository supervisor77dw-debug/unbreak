# UNBREAK ONE - Auth & Rollen Setup

## 📋 Übersicht

Dieses Dokument beschreibt das vollständige Authentication & Authorization System für UNBREAK ONE.

**System:** Supabase Auth + Row Level Security (RLS)  
**Rollen:** customer, staff, admin  
**Portale:** /account (customer), /ops (staff), /admin (admin)

---

## 🏗️ Architektur

### Komponenten

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                          │
├─────────────────────────────────────────────────────┤
│  Login Page (/login.html)                           │
│  Customer Portal (/account.html)                    │
│  Staff Portal (/ops.html)                           │
│  Admin Portal (/admin.html)                         │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              SUPABASE AUTH                          │
│  - Email/Password Authentication                    │
│  - JWT Session Management                           │
│  - Auto-create profile trigger                      │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              DATABASE (RLS Policies)                │
│  - profiles (user roles)                            │
│  - orders (customer_user_id)                        │
│  - products (public read, staff edit)               │
│  - customers, configurations, payments              │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              API ROUTES (Server-Side)               │
│  POST /api/admin/set-role                           │
│  POST /api/admin/products/update                    │
│  POST /api/checkout/create (existing)               │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Rollen-Modell

### Rollen & Berechtigungen

| Rolle | Beschreibung | Zugriff |
|-------|--------------|---------|
| **customer** | Standard-Kunde (Default) | - Eigene Bestellungen einsehen<br>- Eigenes Profil bearbeiten<br>- Checkout durchführen |
| **staff** | Operations-Mitarbeiter | - Alle Bestellungen einsehen<br>- Bestellstatus ändern<br>- Tracking-Nummern setzen<br>- Produktinhalte bearbeiten (Texte) |
| **admin** | Administrator | - Alle Staff-Rechte<br>- Benutzerrollen ändern<br>- Produkte vollständig editieren (inkl. Preise)<br>- Systemkonfiguration |

### Rollenzuweisung

- **Standard:** Neue User erhalten automatisch Rolle `customer` (via Trigger)
- **Änderung:** Nur Admins können Rollen ändern (via Admin Portal oder API)
- **Selbstschutz:** Admin kann eigene Admin-Rolle nicht entfernen

---

## 🗄️ Datenbank Schema

### Tabelle: `profiles`

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','staff','admin')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Trigger:** Auto-create profile on signup

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### RLS Policies

**Profiles:**
- Users can view/update own profile (except role)
- Admins can view/update all profiles

**Orders:**
- Customers see only own orders
- Staff/Admin see all orders
- Staff/Admin can update order status

**Products:**
- Public can view active products
- Staff/Admin can view all products
- Staff/Admin can update products

*Vollständige Policies siehe: [database/auth-setup.sql](../database/auth-setup.sql)*

---

## 🚀 Installation & Setup

### 1. Environment Variables

Füge zu `.env.local` hinzu:

```bash
# Supabase (Client-Side - Safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key

# Supabase (Server-Side - NEVER expose to client!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

**Wichtig:**
- `NEXT_PUBLIC_*` Keys sind für Client-Side (Browser)
- `SUPABASE_SERVICE_ROLE_KEY` ist NUR für Server-Side (API Routes)
- Service Role Key bypassed RLS - niemals im Frontend verwenden!

### 2. Database Migration

Führe das SQL-Setup aus:

```bash
# Option 1: Supabase Dashboard
1. Gehe zu: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
2. Öffne SQL Editor
3. Füge Inhalt von database/auth-setup.sql ein
4. Führe Query aus

# Option 2: Supabase CLI (falls installiert)
supabase db push
```

**Verification:**

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'orders', 'products');

-- Expected: rowsecurity = true for all
```

### 3. Ersten Admin erstellen

Nach dem ersten User-Signup (via Checkout oder manuell):

```sql
-- Via Supabase Dashboard SQL Editor (mit service_role Rechten)
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

**Alternative:** Via Supabase Dashboard
1. Gehe zu: Table Editor → profiles
2. Finde deine E-Mail
3. Editiere `role` Feld → `admin`

### 4. HTML Placeholder ersetzen

In allen Portal-Pages (`login.html`, `account.html`, `ops.html`, `admin.html`):

**Suchen:**
```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
```

**Ersetzen mit:**
```javascript
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'eyJhbGc...your-actual-anon-key';
```

**Automatisierung (Build-Zeit):**

Erstelle ein Build-Script `scripts/inject-env.js`:

```javascript
const fs = require('fs');
const path = require('path');

const files = [
  'public/login.html',
  'public/account.html',
  'public/ops.html',
  'public/admin.html'
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/YOUR_SUPABASE_URL/g, url);
  content = content.replace(/YOUR_SUPABASE_ANON_KEY/g, key);
  fs.writeFileSync(file, content);
});

console.log('✓ Supabase credentials injected');
```

**package.json:**
```json
{
  "scripts": {
    "build": "node scripts/inject-env.js && next build"
  }
}
```

---

## 📱 Portale

### Customer Portal: `/account.html`

**Zugriff:** Nur eingeloggte User mit Rolle `customer`

**Features:**
- ✅ Profilansicht (E-Mail, Rolle, Mitglied seit)
- ✅ Bestellübersicht (nur eigene Orders)
- ✅ Bestelldetails (Status, Tracking, Betrag)
- ✅ Logout

**Redirect-Logik:**
- Nicht eingeloggt → `/login.html`
- Role = staff → `/ops.html`
- Role = admin → `/admin.html`

### Staff Portal: `/ops.html`

**Zugriff:** Nur User mit Rolle `staff` oder `admin`

**Features:**
- ✅ Dashboard mit Statistiken (Gesamt, Ausstehend, In Bearbeitung, Versandt)
- ✅ Alle Bestellungen einsehen
- ✅ Bestellstatus ändern (pending → confirmed → processing → shipped → delivered)
- ✅ Tracking-Nummern setzen
- ✅ Interne Notizen
- ✅ Filter & Sortierung
- ✅ Logout

**Redirect-Logik:**
- Nicht eingeloggt → `/login.html`
- Role = customer → `/account.html`

### Admin Portal: `/admin.html`

**Zugriff:** Nur User mit Rolle `admin`

**Features:**
- ✅ **User Management:** Rollenverwaltung (customer ↔ staff ↔ admin)
- ✅ **Product Management:** Produkte editieren (Name, Beschreibung, Preis, Status)
- ✅ **Order Overview:** Alle Bestellungen einsehen (Read-Only)
- ✅ Tabs: Users / Products / Orders
- ✅ Logout

**Redirect-Logik:**
- Nicht eingeloggt → `/login.html`
- Role != admin → `/account.html`

---

## 🔌 API Endpoints

### POST `/api/admin/set-role`

**Purpose:** Rolle eines Users ändern (Admin-Only)

**Auth:** Requires Bearer token + Admin role

**Request:**
```json
{
  "email": "user@example.com",
  "role": "staff"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role updated successfully for user@example.com",
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "staff",
    "updated_at": "2025-12-27T..."
  }
}
```

**Errors:**
- `401` Unauthorized (kein Token oder ungültiger Token)
- `403` Forbidden (keine Admin-Rechte)
- `400` Invalid role (role not in ['customer','staff','admin'])
- `403` Cannot change own admin role

**Beispiel (JavaScript):**
```javascript
const { data: { session } } = await supabaseClient.auth.getSession();

const response = await fetch('/api/admin/set-role', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    email: 'user@example.com',
    role: 'staff'
  })
});

const result = await response.json();
```

### POST `/api/admin/products/update`

**Purpose:** Produkt bearbeiten (Admin-Only)

**Auth:** Requires Bearer token + Admin role

**Request:**
```json
{
  "productId": "uuid",
  "name_de": "Weinglashalter Premium",
  "name_en": "Wine Glass Holder Premium",
  "description_de": "Neue Beschreibung",
  "description_en": "New description",
  "base_price_cents": 6990,
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product UNBREAK-WEIN-01 updated successfully",
  "product": {
    "id": "uuid",
    "sku": "UNBREAK-WEIN-01",
    "name_de": "Weinglashalter Premium",
    "base_price_cents": 6990,
    "active": true,
    "updated_at": "2025-12-27T..."
  }
}
```

**Errors:**
- `401` Unauthorized
- `403` Forbidden (keine Admin-Rechte)
- `404` Product not found
- `400` Invalid base_price_cents

---

## 🔒 Security Best Practices

### ✅ DO:

1. **Service Role Key nur Server-Side:**
   ```javascript
   // ✅ GOOD: API Route (Server)
   import { supabaseAdmin } from '../../../lib/auth-server.js';
   
   // ❌ BAD: Frontend (Client)
   const supabase = createClient(url, SERVICE_ROLE_KEY); // NEVER!
   ```

2. **RLS Policies aktivieren:**
   ```sql
   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
   ```

3. **Input Validation:**
   ```javascript
   if (!validRoles.includes(role)) {
     return res.status(400).json({ error: 'Invalid role' });
   }
   ```

4. **Role-Based Access Control:**
   ```javascript
   const { hasAccess, role } = await checkRole(['admin']);
   if (!hasAccess) {
     return res.status(403).json({ error: 'Forbidden' });
   }
   ```

### ❌ DON'T:

1. **Service Role Key im Frontend:**
   ```javascript
   // ❌ NEVER expose in HTML/JS sent to browser!
   const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
   ```

2. **RLS deaktivieren:**
   ```sql
   -- ❌ NEVER do this in production!
   ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
   ```

3. **Rollenprüfung nur Client-Side:**
   ```javascript
   // ❌ Client kann manipuliert werden!
   if (userRole === 'admin') {
     // Admin action
   }
   
   // ✅ Server-side verification ALWAYS!
   const { hasAccess } = await requireRole(req, res, ['admin']);
   ```

4. **Passwörter in Logs:**
   ```javascript
   // ❌ NEVER log sensitive data!
   console.log('Login:', email, password);
   ```

---

## 🧪 Testing

### Manual Testing Checklist

**Login Flow:**
- [ ] Login mit gültigen Credentials funktioniert
- [ ] Login mit falschen Credentials zeigt Fehlermeldung
- [ ] Redirect nach Login basierend auf Rolle (customer → /account, staff → /ops, admin → /admin)
- [ ] Logout funktioniert auf allen Portalen

**Customer Portal:**
- [ ] Zeigt nur eigene Bestellungen
- [ ] Redirect zu /login wenn nicht eingeloggt
- [ ] Redirect zu /ops wenn user role = staff
- [ ] Redirect zu /admin wenn user role = admin

**Staff Portal:**
- [ ] Zeigt alle Bestellungen
- [ ] Status-Update funktioniert
- [ ] Tracking-Nummer kann gesetzt werden
- [ ] Filter & Sortierung funktioniert
- [ ] Redirect zu /account wenn role = customer

**Admin Portal:**
- [ ] Rollenverwaltung: Email → Rolle ändern funktioniert
- [ ] Produktbearbeitung: Name, Preis, Status ändern funktioniert
- [ ] Bestellübersicht zeigt alle Orders (Read-Only)
- [ ] Redirect zu /account wenn role != admin

**API Endpoints:**
- [ ] `/api/admin/set-role` erfordert Admin-Token
- [ ] `/api/admin/set-role` verhindert Self-Demotion
- [ ] `/api/admin/products/update` erfordert Admin-Token
- [ ] `/api/admin/products/update` validiert Preise

**RLS Policies:**
- [ ] Customer sieht nur eigene Orders (via Supabase Client)
- [ ] Staff sieht alle Orders
- [ ] Admin kann Rollen ändern
- [ ] Public kann nur aktive Produkte sehen

### Test Users erstellen

```sql
-- Via Supabase Dashboard > Authentication > Users > Invite User
-- Oder via SQL (nach Manual Signup):

-- Customer (default, created automatically)
-- Email: customer@test.com

-- Staff
UPDATE profiles SET role = 'staff' WHERE email = 'staff@test.com';

-- Admin
UPDATE profiles SET role = 'admin' WHERE email = 'admin@test.com';
```

---

## 🐛 Troubleshooting

### Problem: "Missing Supabase environment variables"

**Lösung:**
```bash
# .env.local überprüfen
cat .env.local | grep SUPABASE

# Variablen sollten vorhanden sein:
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Problem: RLS Policy Error - "new row violates row-level security policy"

**Lösung:**
```sql
-- RLS Policies prüfen
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Policies für Tabelle anzeigen
SELECT * FROM pg_policies WHERE tablename = 'orders';
```

### Problem: "Cannot change your own admin role"

**Ursache:** Admin versucht eigene Rolle zu ändern (Sicherheitsfeature)

**Lösung:** Anderen Admin bitten, die Rolle zu ändern, oder via Supabase Dashboard

### Problem: Redirect Loop (login → account → login)

**Ursache:** Session wird nicht korrekt gespeichert

**Lösung:**
```javascript
// Check browser console for errors
const { data: { session } } = await supabaseClient.auth.getSession();
console.log('Session:', session); // Should not be null after login
```

### Problem: Products not visible in Admin Portal

**Ursache:** RLS Policy blockiert Zugriff

**Lösung:**
```sql
-- Prüfen ob RLS Policy für Staff/Admin existiert
SELECT * FROM pg_policies WHERE tablename = 'products';

-- Sollte Policy "Staff view all products" existieren
```

---

## 📚 Dateistruktur

```
unbreak-one/
├── database/
│   └── auth-setup.sql              # Komplettes Auth-Setup (RLS, Trigger)
│
├── lib/
│   ├── auth.js                     # Client-Side Auth Utilities
│   └── auth-server.js              # Server-Side Auth Utilities (service_role)
│
├── pages/
│   └── api/
│       └── admin/
│           ├── set-role.js         # Admin API: Rollenverwaltung
│           └── products/
│               └── update.js       # Admin API: Produktverwaltung
│
├── public/
│   ├── login.html                  # Login Page
│   ├── account.html                # Customer Portal
│   ├── ops.html                    # Staff Portal
│   ├── admin.html                  # Admin Portal
│   │
│   └── components/
│       └── header.js               # Header mit role-based Nav
│
└── .env.local                      # Environment Variables (NOT in git!)
```

---

## 🚀 Next Steps (Optional V2)

- [ ] **Email Verification:** Supabase Email Confirm aktivieren
- [ ] **Password Reset:** /reset-password.html Seite erstellen
- [ ] **Magic Link Login:** Alternative zu Email/Password
- [ ] **2FA:** Two-Factor Authentication für Admins
- [ ] **Audit Log:** Log aller Admin-Aktionen (role changes, product edits)
- [ ] **User Deletion:** Admin kann User löschen (via API + Supabase Admin)
- [ ] **Bulk Actions:** Mehrere Orders gleichzeitig bearbeiten (Ops Portal)
- [ ] **Advanced Permissions:** Granulare Rechte (z.B. staff kann nur Status ändern, nicht Preise)

---

## 📞 Support

**Fragen zum Auth-System?**

1. Check Logs: Browser Console (F12) + Supabase Dashboard Logs
2. Check RLS Policies: Supabase Dashboard > Authentication > Policies
3. Check Environment: `.env.local` vollständig?

**Erste Schritte:**
1. Run SQL-Setup: [database/auth-setup.sql](../database/auth-setup.sql)
2. Erstelle ersten Admin (siehe oben)
3. Ersetze Placeholders in HTML-Files
4. Test Login → Redirect → Portal Access

---

**Version:** 1.0  
**Letzte Aktualisierung:** 27.12.2025  
**Autor:** GitHub Copilot + User
