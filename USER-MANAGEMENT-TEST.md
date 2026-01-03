# User Management Test Guide

## Voraussetzungen
1. Migrations 001 + 009 müssen in Supabase ausgeführt sein
2. Ein Admin-User muss existieren (mit role='admin' in profiles)
3. SUPABASE_SERVICE_ROLE_KEY in Vercel gesetzt

## Test 1: Users anzeigen (2 Minuten)

### Schritte:
1. Im Admin-Panel einloggen (als Admin)
2. Zu `/admin/users` navigieren
3. Prüfen: Tabelle zeigt alle Users aus auth.users

### Erwartetes Ergebnis:
- ✅ Tabelle zeigt mindestens Admin + Standard-User
- ✅ Spalten: Email, Name, Role, Status, Last Login, Actions
- ✅ Role badges farbcodiert (Admin=rot, Ops=orange, etc.)
- ✅ Status zeigt "Active" oder "Inactive"
- ✅ Last Login zeigt deutsches Datum oder "Never"

### Fehlerbehebung:
- 401 Error → SUPABASE_SERVICE_ROLE_KEY fehlt
- Leere Tabelle → Migration 001 nicht ausgeführt oder keine Users

## Test 2: User einladen (3 Minuten)

### Schritte:
1. Button "📧 Invite User" klicken
2. Email: `test-invite@example.com` eingeben
3. Role: "support" wählen
4. Display Name: "Test Support" (optional)
5. "Send Invitation" klicken

### Erwartetes Ergebnis:
- ✅ Alert: "✅ Invitation sent successfully!"
- ✅ Email wird an test-invite@example.com gesendet
- ✅ User erscheint in Tabelle (role=support, status=Active)
- ✅ Bei Login: User muss Passwort setzen (magic link)

### Fehlerbehebung:
- "Failed to invite user" → Email bereits existiert oder SMTP nicht konfiguriert
- Kein Alert → Browser-Console checken
- User nicht sichtbar → fetchUsers() refresh fehlgeschlagen

## Test 3: User erstellen (3 Minuten)

### Schritte:
1. Button "➕ Create User" klicken
2. Email: `test-create@example.com`
3. Password: `Test1234!` (min. 8 chars)
4. Role: "designer"
5. Display Name: "Test Designer"
6. "Create User" klicken

### Erwartetes Ergebnis:
- ✅ Alert: "✅ User created successfully!"
- ✅ User erscheint in Tabelle (role=designer, display_name="Test Designer")
- ✅ User kann sofort mit test-create@example.com + Test1234! einloggen
- ✅ Email ist auto-confirmed (kein Bestätigungs-Link nötig)

### Fehlerbehebung:
- "Password must be at least 8 characters" → Längeres Passwort
- "User already exists" → Email bereits in auth.users
- User kann nicht einloggen → Passwort falsch oder is_active=false

## Test 4: Role ändern (2 Minuten)

### Schritte:
1. Bei einem User (nicht Admin!) "Change Role" klicken
2. Neuen Role eingeben: `ops`
3. OK klicken

### Erwartetes Ergebnis:
- ✅ Alert: "✅ User updated successfully!"
- ✅ Role badge ändert sich zu "Operations" (orange)
- ✅ In Supabase: profiles.role = 'ops'
- ✅ User hat sofort neue Berechtigungen (RLS policies)

### Fehlerbehebung:
- "Invalid role" → Nur admin|ops|support|designer|finance|user erlaubt
- Keine Änderung sichtbar → Browser-Cache, Seite neu laden

## Test 5: User deaktivieren (2 Minuten)

### Schritte:
1. Bei einem User "Deactivate" klicken
2. Confirm-Dialog mit OK bestätigen

### Erwartetes Ergebnis:
- ✅ Alert: "✅ User updated successfully!"
- ✅ Status badge wird rot: "Inactive"
- ✅ Button ändert sich zu "Activate" (grün)
- ✅ User kann sich nicht mehr einloggen (RLS blockiert)
- ✅ In Supabase: profiles.is_active = false

### Reaktivierung:
- "Activate" klicken → is_active=true, User kann wieder einloggen

### Fehlerbehebung:
- User kann sich noch einloggen → RLS policy in Migration 009 prüfen
- Status ändert sich nicht → PATCH endpoint error, Console checken

## Test 6: Filter & Search (2 Minuten)

### Schritte:
1. Search: Email-Teil eingeben (z.B. "test")
2. Role Filter: "support" wählen
3. Status Filter: "Active" wählen

### Erwartetes Ergebnis:
- ✅ Tabelle zeigt nur Users, die alle Filter erfüllen
- ✅ Leere Sucheingabe → alle Users
- ✅ Kombination funktioniert (search + role + status)

## Gesamtdauer: ~14 Minuten

## Akzeptanzkriterien Check:

✅ 1) Admin-Panel zeigt alle Users aus auth.users (Test 1)  
✅ 2) Einladung erzeugt User + Profile (Test 2)  
✅ 3) Create erzeugt User + Profile (Test 3)  
✅ 4) Role-Änderung wirkt sofort (Test 4)  
✅ 5) Deaktivierter User hat keinen Zugriff (Test 5)

## Production Checklist:

- [ ] SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables gesetzt
- [ ] Migration 001 + 009 in Supabase SQL Editor ausgeführt
- [ ] Admin user existiert: `UPDATE profiles SET role='admin' WHERE email='YOUR_ADMIN_EMAIL'`
- [ ] SMTP konfiguriert (für Invite-Emails)
- [ ] NEXT_PUBLIC_SITE_URL korrekt gesetzt (für Callback)

## Troubleshooting:

**401 "Invalid token"**  
→ Session-Token fehlt oder abgelaufen. Neu einloggen.

**401 "Insufficient permissions"**  
→ User ist nicht Admin. `UPDATE profiles SET role='admin' WHERE id='...'`

**500 "Failed to fetch users"**  
→ SUPABASE_SERVICE_ROLE_KEY fehlt oder falsch

**Invite Email kommt nicht an**  
→ SMTP Settings in Supabase > Project Settings > Auth > SMTP  
→ Alternativ: Supabase Email Templates aktivieren

**User in Tabelle, aber kein Login möglich**  
→ is_active=false setzen. Oder email_confirmed_at ist null (bei Invite).
