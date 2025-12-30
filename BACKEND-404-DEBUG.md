# Backend 404 Troubleshooting

## Mögliche Ursachen:

### 1. ⏳ Vercel Deployment läuft noch
**Letzte Commits:**
- `202f809` - fix: Require SUPABASE_SERVICE_ROLE_KEY (vor ~5 Min)
- `7d6927f` - fix: Add robust error handling (vor ~10 Min)

**Lösung:** Warte 1-2 Minuten, dann Hard-Refresh (`Strg + Shift + R`)

**Prüfen:** 
- Öffne https://vercel.com/supervisor77dw-debug/unbreak/deployments
- Schau ob Status "Building..." oder "Ready"

---

### 2. ❌ SUPABASE_SERVICE_ROLE_KEY fehlt
**Symptom:** Backend lädt, aber API-Calls fehlschlagen

**Lösung:**
1. Hole Key: https://supabase.com/dashboard → Settings → API → Service Role
2. Setze in Vercel: https://vercel.com/supervisor77dw-debug/unbreak/settings/environment-variables
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: [Der Key]
   - Environment: ✅ Alle
3. **WICHTIG:** Redeploy triggern!

---

### 3. 🗄️ Storage Bucket fehlt
**Symptom:** Upload schlägt fehl

**Lösung:** SQL in Supabase ausführen (komplett [database/EXECUTE-NOW.sql](database/EXECUTE-NOW.sql))

---

### 4. 🔐 Nicht eingeloggt
**Symptom:** Backend redirected zu /login.html

**Lösung:** 
1. Gehe zu `/login.html`
2. Login mit Admin/Staff Account
3. Automatisch redirect zu `/backend`

---

## Quick Check Liste:

```
☐ Vercel Deployment Status "Ready"?
☐ Hard-Refresh gemacht? (Strg + Shift + R)
☐ Console Logs gecheckt? (F12 → Console)
☐ Network Tab gecheckt? (F12 → Network, welche URL gibt 404?)
☐ Eingeloggt? (Check ob redirect zu /login.html)
```

## Erwartetes Verhalten:

**Nach Login:**
1. `/login.html` → Login → Auto-redirect zu `/backend`
2. `/backend` → Dashboard mit "Produkte" Card
3. `/backend/products` → Produktliste

**404 ist OK für:**
- `/backend` wenn nicht eingeloggt → redirect
- Alte URLs wie `/admin/products`, `/my-products` → redirect zu `/backend/products`

**404 ist NICHT OK für:**
- `/backend` NACH Login
- `/backend/products` NACH Login
- `/api/config`
- `/api/products/upload`

## Debug Steps:

1. **Öffne Browser Console** (F12)
2. **Gehe zu:** https://unbreak.vercel.app/backend
3. **Schau Console:**
   - Auth error? → Login Problem
   - 404 on specific API? → Welche?
   - Redirect loop? → Auth Problem

4. **Schau Network Tab:**
   - Welche Requests sind rot (404/500)?
   - Was ist der genaue Pfad?

5. **Teile mit:**
   - Genaue URL die 404 gibt
   - Console Error Messages
   - Network Tab Screenshot

## Notfall-Rollback:

Falls alles broken:
```powershell
git log --oneline -5  # Siehe letzte Commits
git revert HEAD       # Rollback letzter Commit
git push
```

Dann warte ~2 Min für Vercel Redeploy.
