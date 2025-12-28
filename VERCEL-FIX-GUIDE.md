# VERCEL DEPLOYMENT - NEUSTART

## PROBLEM
- unbreak.vercel.app zeigt falsches Projekt ("Fast Hand App")
- Git-Repository scheint falsch verbunden zu sein

## LÖSUNG - VERCEL DASHBOARD

### 1. Aktuelles Projekt prüfen
1. Gehe zu: https://vercel.com/dashboard
2. Finde Projekt "unbreak" (oder ähnlich)
3. Klicke auf Settings

### 2. Git-Repository prüfen
- **Sollte sein**: github.com/supervisor77dw-debug/unbreak
- **Branch**: master
- **Root Directory**: . (Projektroot)

### 3. Wenn falsches Repository
**Option A - Projekt löschen und neu erstellen**:
1. Settings → General → Delete Project
2. New Project → Import Git Repository
3. Wähle: supervisor77dw-debug/unbreak
4. Framework Preset: Next.js
5. Build Command: npm run build
6. Output Directory: .next
7. Install Command: npm install

**Option B - Repository neu verbinden**:
1. Settings → Git
2. Disconnect
3. Connect to Different Git Repository
4. Wähle: supervisor77dw-debug/unbreak

### 4. Environment Variables setzen
Settings → Environment Variables (für ALL Environments):

**Kopiere Werte aus `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=<deine_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dein_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<dein_supabase_service_role_key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<dein_stripe_publishable_key>
STRIPE_SECRET_KEY=<dein_stripe_secret_key>
```

Die Werte findest du in deiner lokalen `.env.local` Datei.

### 5. Redeploy
- Deployments → Latest → ... → Redeploy
- ODER: Git Push triggert automatisch

## VERIFIKATION
Nach Deployment:
1. https://unbreak.vercel.app/ → Sollte UNBREAK ONE zeigen
2. https://unbreak.vercel.app/shop → Sollte Shop-Seite zeigen
3. Nicht mehr "Fast Hand App"!

## FALLBACK - CLI Deployment
Falls Dashboard nicht funktioniert:

```bash
npm install -g vercel
vercel login
vercel --prod
```

## AKTUELLER STATUS
- ✅ Git Repository: korrekt (supervisor77dw-debug/unbreak)
- ✅ Code: korrekt (master branch, letzter commit ac50ab1)
- ✅ vercel.json: erstellt
- ❌ Vercel Projekt: zeigt falsches Projekt
- **NEXT STEP**: Vercel-Dashboard → Projekt prüfen/neu verbinden
