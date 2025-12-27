# 🔐 Rollen & Zugriff – Quick Reference

**UNBREAK ONE – Role-Based Access Control (RBAC)**

---

## 👥 Rollen-Übersicht

| Rolle | Default? | Beschreibung | Portal |
|-------|----------|--------------|--------|
| **customer** | ✅ Ja | Standard-Kunde nach Registrierung | /account |
| **staff** | ❌ | Operations-Mitarbeiter (Manual Assignment) | /ops |
| **admin** | ❌ | System-Administrator (Manual Assignment) | /admin |

---

## 📋 Berechtigungs-Matrix

### Orders (Bestellungen)

| Aktion | customer | staff | admin |
|--------|----------|-------|-------|
| Eigene Orders einsehen | ✅ | ✅ | ✅ |
| Alle Orders einsehen | ❌ | ✅ | ✅ |
| Order-Status ändern | ❌ | ✅ | ✅ |
| Tracking-Nummer setzen | ❌ | ✅ | ✅ |
| Orders löschen | ❌ | ❌ | ✅ |

### Products (Produkte)

| Aktion | customer | staff | admin |
|--------|----------|-------|-------|
| Produkte ansehen | ✅ | ✅ | ✅ |
| Produkte kaufen | ✅ | ✅ | ✅ |
| Texte/Beschreibungen bearbeiten | ❌ | ✅ | ✅ |
| Preise ändern | ❌ | ❌ | ✅ |
| Produkte erstellen/löschen | ❌ | ❌ | ✅ |
| Produkte aktivieren/deaktivieren | ❌ | ✅ | ✅ |

### Bundles & Presets

| Aktion | customer | staff | admin |
|--------|----------|-------|-------|
| Aktive Bundles/Presets sehen | ✅ | ✅ | ✅ |
| Bundles/Presets kaufen | ✅ | ✅ | ✅ |
| Bundles/Presets erstellen | ❌ | ✅ | ✅ |
| Bundles/Presets bearbeiten | ❌ | ✅ | ✅ |
| Bundles/Presets löschen | ❌ | ❌ | ✅ |

### User Profiles

| Aktion | customer | staff | admin |
|--------|----------|-------|-------|
| Eigenes Profil ansehen | ✅ | ✅ | ✅ |
| Eigenes Profil bearbeiten | ✅ | ✅ | ✅ |
| Eigene Rolle ändern | ❌ | ❌ | ❌ |
| Alle Profile ansehen | ❌ | ❌ | ✅ |
| User-Rollen ändern | ❌ | ❌ | ✅ |

---

## 🚪 Zugriffs-Regeln

### customer

**Erlaubt:**
```
/                    # Homepage
/shop                # Shop
/configurator        # Konfigurator
/account             # Eigenes Konto
/login               # Login
/produkt             # Produktseiten
```

**Redirect zu /account:**
```
/ops                 # Staff-Portal → /account
/admin               # Admin-Portal → /account
```

---

### staff

**Erlaubt:**
```
/                    # Homepage
/shop                # Shop
/configurator        # Konfigurator
/account             # Eigenes Konto
/ops                 # Operations-Portal ✅
/ops/catalog         # Katalog-Management ✅
/login               # Login
```

**Redirect zu /ops:**
```
/admin               # Admin-Portal → /ops
```

---

### admin

**Erlaubt:**
```
/                    # Homepage
/shop                # Shop
/configurator        # Konfigurator
/account             # Eigenes Konto
/ops                 # Operations-Portal ✅
/ops/catalog         # Katalog-Management ✅
/admin               # Admin-Portal ✅
/login               # Login
```

**Keine Redirects** – Admin hat überall Zugriff.

---

## 🔧 Rollenverwaltung

### Rolle zuweisen (Admin Only)

**Option 1: Supabase SQL Editor**
```sql
UPDATE public.profiles
SET role = 'staff'  -- oder 'admin'
WHERE email = 'mitarbeiter@unbreak-one.com';
```

**Option 2: Admin-Portal UI**
```
/admin → User Management → Select User → Change Role
```

**Option 3: API (geplant)**
```bash
POST /api/admin/set-role
{
  "user_id": "uuid",
  "role": "staff"
}
```

---

### Erste Admin-Rolle setzen

```sql
-- 1. User in Supabase Auth UI erstellen
-- 2. Dann SQL ausführen:
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@unbreak-one.com';
```

---

## 🛡️ RLS Policies (Beispiele)

### Orders

**Policy 1: Customer sieht eigene Orders**
```sql
CREATE POLICY "Customers view own orders"
  ON public.orders
  FOR SELECT
  USING (customer_user_id = auth.uid());
```

**Policy 2: Staff/Admin sehen alle Orders**
```sql
CREATE POLICY "Staff view all orders"
  ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );
```

---

### Products

**Policy 1: Public Read (Anon + Auth)**
```sql
CREATE POLICY "Public can view active products"
  ON public.products
  FOR SELECT
  USING (active = true);
```

**Policy 2: Staff kann Texte bearbeiten (nicht Preise)**
```sql
CREATE POLICY "Staff can update product content"
  ON public.products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  )
  WITH CHECK (
    -- Staff kann nicht Preise ändern (Constraint hier nicht möglich, via App-Logic)
    true
  );
```

**Policy 3: Admin Full Access**
```sql
CREATE POLICY "Admins have full product access"
  ON public.products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 🧪 Permission Testing

### Als customer eingeloggt

**Sollte funktionieren:**
```sql
SELECT * FROM orders WHERE customer_user_id = auth.uid();  -- ✅
SELECT * FROM products WHERE active = true;                 -- ✅
```

**Sollte NICHT funktionieren:**
```sql
SELECT * FROM orders WHERE customer_user_id != auth.uid();  -- ❌ Leer
UPDATE orders SET status = 'shipped' WHERE id = '...';      -- ❌ Error
UPDATE products SET base_price_cents = 9900 WHERE...;      -- ❌ Error
```

---

### Als staff eingeloggt

**Sollte funktionieren:**
```sql
SELECT * FROM orders;                                       -- ✅ Alle
UPDATE orders SET status = 'shipped' WHERE id = '...';      -- ✅
UPDATE bundles SET title_de = 'Neuer Titel' WHERE...;     -- ✅
INSERT INTO presets (...) VALUES (...);                     -- ✅
```

**Sollte NICHT funktionieren:**
```sql
UPDATE products SET base_price_cents = 9900 WHERE...;      -- ❌ (App-seitig blockiert)
DELETE FROM products WHERE...;                             -- ❌ Error
UPDATE profiles SET role = 'admin' WHERE...;               -- ❌ Error
```

---

### Als admin eingeloggt

**Alles sollte funktionieren:**
```sql
SELECT * FROM orders;                                       -- ✅
UPDATE orders SET ...;                                      -- ✅
UPDATE products SET base_price_cents = 9900 WHERE...;      -- ✅
DELETE FROM products WHERE...;                             -- ✅
UPDATE profiles SET role = 'staff' WHERE...;               -- ✅
INSERT INTO bundles/presets/products ...;                   -- ✅
```

---

## 🔐 Frontend Role-Check

### JavaScript (lib/auth.js)

```javascript
import { getUserProfile } from './lib/auth.js';

// Get current user + profile
const { user, profile } = await getUserProfile();

// Check role
if (!profile) {
  window.location.href = '/login.html';
}

if (profile.role !== 'admin') {
  window.location.href = '/account.html';
}

// Continue with admin code...
```

### HTML (Page Load)

```html
<!-- In /admin.html -->
<script type="module">
  import { getUserProfile } from './lib/auth.js';
  
  document.addEventListener('DOMContentLoaded', async () => {
    const { profile } = await getUserProfile();
    
    if (!profile) {
      window.location.href = '/login.html';
      return;
    }
    
    if (profile.role !== 'admin') {
      window.location.href = '/account.html';
      return;
    }
    
    // Admin page logic
  });
</script>
```

---

## 🔧 Backend Role-Check (Next.js API)

### Middleware (lib/auth-server.js)

```javascript
import { requireRole } from '@/lib/auth-server';

export default async function handler(req, res) {
  try {
    // Require admin role
    const { user, profile } = await requireRole(req, ['admin']);
    
    // Admin-only code
    const { data } = await supabase
      .from('profiles')
      .update({ role: req.body.role })
      .eq('id', req.body.user_id);
    
    return res.json({ success: true });
    
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden' });
  }
}
```

---

## 📊 Role Assignment Flowchart

```
┌─────────────────┐
│  User Sign Up   │
│  (Email/PW)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Auto-Create    │
│  Profile        │
│  role=customer  │ ◄── Trigger: handle_new_user()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Login     │
│  → /account     │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Admin   │
    │ Manual  │
    │ Action  │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  UPDATE role    │
│  'staff'/'admin'│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Login     │
│  → /ops or      │
│     /admin      │
└─────────────────┘
```

---

## ✅ Checkliste: Neue Rolle erstellen

**Hypothetisches Beispiel: `moderator` Rolle**

1. **Schema erweitern:**
   ```sql
   ALTER TABLE profiles 
   DROP CONSTRAINT profiles_role_check;
   
   ALTER TABLE profiles 
   ADD CONSTRAINT profiles_role_check 
   CHECK (role IN ('customer', 'staff', 'admin', 'moderator'));
   ```

2. **RLS Policies hinzufügen:**
   ```sql
   CREATE POLICY "Moderators can view flagged content"
     ON public.reviews
     FOR SELECT
     USING (
       flagged = true AND
       EXISTS (
         SELECT 1 FROM public.profiles 
         WHERE id = auth.uid() AND role IN ('moderator', 'admin')
       )
     );
   ```

3. **Frontend Route erstellen:**
   ```
   /moderate.html
   ```

4. **Navigation anpassen:**
   ```javascript
   // components/header.js
   if (profile.role === 'moderator' || profile.role === 'admin') {
     nav += '<a href="/moderate.html">Moderation</a>';
   }
   ```

5. **Backend API schützen:**
   ```javascript
   const { user, profile } = await requireRole(req, ['moderator', 'admin']);
   ```

---

## 🚨 Wichtige Sicherheitshinweise

1. **Service Role Key NIE im Frontend**
   ```javascript
   // ❌ FALSCH
   const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
   
   // ✅ RICHTIG (Client-Side)
   const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
   ```

2. **RLS immer aktiviert**
   ```sql
   -- Für jede neue Tabelle:
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ```

3. **Frontend-Checks sind nur UX**
   ```javascript
   // Frontend Role-Check verhindert nur UI-Zugriff
   // Aber: Server MUSS nochmal prüfen (RLS + Backend)
   if (profile.role !== 'admin') {
     window.location.href = '/account.html';  // UX, NICHT Security
   }
   ```

4. **Backend-Validierung IMMER**
   ```javascript
   // JEDE API-Route muss Role checken:
   const { user, profile } = await requireRole(req, ['staff', 'admin']);
   ```

---

**Erstellt:** 27. Dezember 2025  
**Version:** 1.0  
**Autor:** GitHub Copilot
