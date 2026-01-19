# User Management - Lokaler Testplan
> **Datum:** 2026-01-19
> **Status:** 🔄 In Progress

---

## Voraussetzungen
- ✅ Lokaler Dev-Server läuft auf http://localhost:3000
- ✅ `.env.local` mit korrekten Credentials
- ✅ `admin_users` synchronisiert mit `auth.users` IDs

## Test-User
| Email | ID | Role |
|-------|-----|------|
| admin@unbreak-one.com | `e49bb8a6-b812-4171-b60b-b96ca96ee600` | ADMIN |
| nina@unbreak-one.com | `63d1445f-cacf-4ea1-91ff-752408f631cc` | SUPPORT |

---

## Testplan

### Test 1: Admin Login
**URL:** http://localhost:3000/admin/login
**Schritte:**
1. Öffne Login-Seite
2. Email: `admin@unbreak-one.com`
3. Password: (bekanntes Passwort)
4. Klicke "Anmelden"

**Erwartetes Ergebnis:**
- [ ] Login erfolgreich
- [ ] Weiterleitung zu `/admin`
- [ ] Session zeigt korrekten Namen/Role

---

### Test 2: User-Liste anzeigen
**URL:** http://localhost:3000/admin/users
**Schritte:**
1. Nach Login auf "Benutzer" navigieren
2. User-Liste prüfen

**Erwartetes Ergebnis:**
- [ ] Liste zeigt beide User (admin, nina)
- [ ] Rollen korrekt (ADMIN, SUPPORT)
- [ ] Keine Fehler in Console

---

### Test 3: Username ändern
**URL:** http://localhost:3000/admin/users
**Schritte:**
1. User "Nina" anklicken
2. Namen ändern zu "Nina Test"
3. Speichern

**Erwartetes Ergebnis:**
- [ ] Update erfolgreich (Toast/Meldung)
- [ ] UI zeigt neuen Namen sofort oder nach Refresh
- [ ] In DB: `admin_users.name = 'Nina Test'`
- [ ] Console: `[UPDATE USER] Supabase Auth metadata synced`

**Prüfung in DB:**
```sql
SELECT name FROM admin_users WHERE email = 'nina@unbreak-one.com';
-- Erwartetes Ergebnis: 'Nina Test'
```

---

### Test 4: Passwort-Reset
**URL:** http://localhost:3000/admin/users
**Schritte:**
1. User "Nina" auswählen
2. "Passwort zurücksetzen" klicken
3. Neues Passwort eingeben: `TestPass123!`
4. Bestätigen

**Erwartetes Ergebnis:**
- [ ] Erfolg: "Passwort wurde geändert"
- [ ] Console: `[RESET PASSWORD] Success for nina@unbreak-one.com`

**Verifizierung:**
1. Abmelden
2. Login mit `nina@unbreak-one.com` + altem Passwort → MUSS fehlschlagen
3. Login mit `nina@unbreak-one.com` + `TestPass123!` → MUSS funktionieren

---

### Test 5: Rechte/Role bleibt erhalten
**Schritte:**
1. Namen von Nina ändern (ohne Role zu ändern)
2. Speichern
3. Role prüfen

**Erwartetes Ergebnis:**
- [ ] Role ist immer noch "SUPPORT"
- [ ] Keine ungewollte Änderung

---

### Test 6: Keine doppelten Emails
**Schritte:**
1. Neuen User anlegen mit existierender Email
2. Speichern versuchen

**Erwartetes Ergebnis:**
- [ ] Fehler: "Email existiert bereits" o.ä.
- [ ] Kein doppelter Eintrag in DB

---

## Ergebnis-Zusammenfassung

| Test | Status | Notizen |
|------|--------|---------|
| 1. Admin Login | ⬜ | |
| 2. User-Liste | ⬜ | |
| 3. Username ändern | ⬜ | |
| 4. Passwort-Reset | ⬜ | |
| 5. Role erhalten | ⬜ | |
| 6. Keine Duplikate | ⬜ | |

---

## Nach erfolgreichen Tests

Wenn ALLE Tests ✅ grün sind:

```bash
git add .
git commit -m "RC: User Management SSOT - Local Tests Passed"
# DANN ERST: git push origin master (triggert Vercel Deploy)
```

---

## Fingerprint-Verifizierung

Beim Testen sollten diese Logs erscheinen:

```
[DATASOURCE] ctx=admin_users_detail, supabaseProject=qnzsdytdghfukrqpscsg
[AUTH] ✅ Login successful: admin@unbreak-one.com (ADMIN)
[UPDATE USER] Supabase Auth metadata synced for nina@unbreak-one.com
```
