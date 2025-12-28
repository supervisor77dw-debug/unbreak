# Admin-System Setup für Unbreak One

## Übersicht

Das Admin-System besteht aus:
- **Login-Seite** (`/public/login.html`) - Authentifizierung mit Supabase Auth
- **Admin-Dashboard** (`/public/admin.html`) - Produktverwaltung für Admins
- **Profiles-Tabelle** - Speichert Benutzerrollen (admin/user)
- **RLS-Policies** - Sichert Datenbank-Zugriff

## Installation

### 1. Datenbank-Schema einrichten

Führen Sie das SQL-Skript in Supabase aus:

```bash
# Datei: database/add-admin-system.sql
```

Gehen Sie zu **Supabase Dashboard → SQL Editor** und führen Sie den gesamten Inhalt der Datei aus.

Das Skript erstellt:
- ✅ `profiles` Tabelle mit Spalten: id, email, role, created_at, updated_at
- ✅ RLS-Policies für `profiles` (Benutzer können eigenes Profil lesen, Admins alle)
- ✅ RLS-Policies für `products` (Öffentlich lesen, nur Admins ändern)
- ✅ Trigger `handle_new_user()` - Erstellt automatisch Profil bei Registrierung

### 2. Test-Accounts erstellen

#### Admin-Account:
1. Gehen Sie zu **Supabase Dashboard → Authentication → Users**
2. Klicken Sie auf **"Add user"**
3. Geben Sie ein:
   - Email: `admin@unbreak-one.local`
   - Password: `Unbreak123!`
   - Confirm Email: **aktivieren** (damit kein Bestätigungslink nötig ist)
4. Klicken Sie **"Create user"**

5. Gehen Sie zu **SQL Editor** und führen Sie aus:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@unbreak-one.local';
```

#### Optional - Normaler Benutzer:
Wiederholen Sie Schritte 1-4 mit:
- Email: `user@unbreak-one.local`
- Password: `User123!`

(Dieser Benutzer hat automatisch `role = 'user'` durch den Trigger)

### 3. Funktionsprüfung

1. **Login testen:**
   - Öffnen Sie: `http://localhost:5173/login.html` (Dev) oder `https://ihre-domain.de/login.html` (Production)
   - Melden Sie sich mit `admin@unbreak-one.local` / `Unbreak123!` an
   - Sie sollten automatisch auf `/admin.html` weitergeleitet werden

2. **Admin-Dashboard testen:**
   - Prüfen Sie, ob Produkte geladen werden
   - Klicken Sie **"+ Neues Produkt"**
   - Erstellen Sie ein Testprodukt
   - Prüfen Sie, ob es in der Tabelle erscheint

3. **Shop-Ansicht testen:**
   - Öffnen Sie `/shop` (wenn vorhanden)
   - Neue Produkte mit `active = true` sollten sichtbar sein

## Dateistruktur

```
public/
├── login.html          # Login-Seite (Supabase Auth)
└── admin.html          # Admin-Dashboard (Produktverwaltung)

database/
└── add-admin-system.sql   # SQL-Setup für profiles + RLS
```

## Sicherheit

### Row Level Security (RLS)

**Profiles-Tabelle:**
- ✅ Benutzer können nur ihr eigenes Profil lesen
- ✅ Admins können alle Profile lesen
- ✅ Kein direktes UPDATE/DELETE ohne Service Role

**Products-Tabelle:**
- ✅ Öffentlich: Nur aktive Produkte lesen (`active = true`)
- ✅ Admins: Voller Zugriff (SELECT, INSERT, UPDATE, DELETE)
- ✅ Normale Benutzer: Kein Schreibzugriff

### Authentication Flow

1. User landet auf `/login.html`
2. Supabase Auth prüft Credentials
3. Nach erfolgreichem Login: Abfrage der `profiles` Tabelle für `role`
4. Redirect basierend auf Rolle:
   - `role = 'admin'` → `/admin.html`
   - `role = 'user'` → `/` (oder `/account.html`)

## API-Zugriff

Das Admin-Dashboard nutzt **Supabase Client-Side SDK**:

```javascript
// Login
await supabase.auth.signInWithPassword({ email, password });

// Produkte laden (nur wenn admin)
const { data } = await supabase.from('products').select('*');

// Produkt erstellen (nur admin, durch RLS geschützt)
await supabase.from('products').insert([productData]);
```

## Troubleshooting

### Problem: "Unauthorized" beim Produktanlegen
**Lösung:** Prüfen Sie, ob der User wirklich `role = 'admin'` in der `profiles` Tabelle hat:
```sql
SELECT * FROM profiles WHERE email = 'admin@unbreak-one.local';
```

### Problem: Redirect auf `/` statt `/admin.html`
**Lösung:** Profil wurde nicht korrekt erstellt. Führen Sie manuell aus:
```sql
INSERT INTO profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'admin@unbreak-one.local'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### Problem: 404 bei `/login.html` oder `/admin.html`
**Lösung:** 
- **Vite Dev:** Dateien müssen im `public/` Ordner liegen (✅ korrekt)
- **Vercel Production:** Prüfen Sie Build-Logs, ob Dateien deployed wurden

## Erweiterungen

### Navigation-Link hinzufügen

Fügen Sie in Ihrer Hauptnavigation (z.B. Header) hinzu:

```javascript
// Prüfen, ob User eingeloggt ist
const { data: { session } } = await supabase.auth.getSession();

if (session) {
  // Zeige "Admin" Link nur für Admins
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  
  if (profile?.role === 'admin') {
    // Zeige Admin-Link
    document.getElementById('admin-link').style.display = 'block';
  }
}
```

### Logout-Funktion

```javascript
async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/';
}
```

## Nächste Schritte

- [ ] Weitere Felder für Produkte (z.B. Kategorie, Tags)
- [ ] Bildupload direkt in Supabase Storage
- [ ] Bestellverwaltung im Admin-Dashboard
- [ ] Benutzerverwaltung (Admins können Rollen ändern)
- [ ] Export-Funktion für Produktdaten (CSV/JSON)

## Support

Bei Fragen oder Problemen:
1. Prüfen Sie die **Browser-Konsole** (F12) auf Fehlermeldungen
2. Prüfen Sie **Supabase Dashboard → Logs** für Backend-Errors
3. Verifizieren Sie RLS-Policies in **Database → Policies**
