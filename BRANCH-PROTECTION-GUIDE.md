# Branch Protection & Deployment Strategy

**Erstellt:** 15. Januar 2026  
**Status:** ✅ Aktiv

## 📊 Branch-Übersicht

```
master (PRODUCTION - FROZEN)
├── Commit: 7a087a9
├── Status: Eingefroren für Messe
├── Vercel: Production Deployment
└── URL: https://unbreak-one.vercel.app

post-messe (DEVELOPMENT)
├── Basis: master @ 7a087a9
├── Commit: 9a47c68 (2 commits ahead)
├── Vercel: Preview Deployment
└── URL: https://post-messe-*.vercel.app (auto-generated)
```

## 🔒 Production Freeze Rules

**WÄHREND DER MESSE (14./15. Januar 2026):**

❌ **NICHT auf master:**
- Keine Commits
- Kein Force-Push
- Kein Rebase
- Kein Branch-Löschen
- Keine Vercel-Settings-Änderungen

✅ **NUR auf post-messe:**
- Alle Entwicklung
- Alle Tests
- Alle Features
- Alle Bugfixes (nicht-kritisch)

## 🚨 Emergency Hotfix Process

**Falls kritischer Bug auf Production:**

```bash
# 1. Hotfix-Branch von master
git checkout master
git checkout -b hotfix/critical-bug-name

# 2. Fix implementieren
# ... code changes ...

# 3. Commit & Push
git commit -m "HOTFIX: Critical bug description"
git push origin hotfix/critical-bug-name

# 4. Merge zu master (Production)
git checkout master
git merge hotfix/critical-bug-name --no-ff
git push origin master

# 5. Merge zu post-messe (Development)
git checkout post-messe
git merge hotfix/critical-bug-name --no-ff
git push origin post-messe

# 6. Cleanup
git branch -d hotfix/critical-bug-name
git push origin --delete hotfix/critical-bug-name
```

## 🚀 Vercel Deployment Flow

### Automatic Deployments:

**Production (master):**
```
Trigger: Push zu master (NUR Hotfixes!)
URL: unbreak-one.vercel.app
Environment: Production
Database: Production Supabase
```

**Preview (post-messe):**
```
Trigger: Push zu post-messe
URL: post-messe-XXXXX.vercel.app (auto)
Environment: Preview
Database: Production Supabase (shared)
```

### Vercel Dashboard Check:

1. Öffne https://vercel.com/your-team/unbreak-one
2. Tabs: **Deployments**
3. Filter: **Production** → Sollte master @ 7a087a9 zeigen
4. Filter: **Preview** → Sollte post-messe @ 9a47c68 zeigen

## ✅ Verification Checklist

**Nach Setup:**

- [ ] Branch `post-messe` existiert auf GitHub
- [ ] Branch `master` ist auf commit 7a087a9
- [ ] Vercel zeigt Production (master) als stable
- [ ] Vercel zeigt Preview (post-messe) als neueste
- [ ] Production-URL funktioniert (unbreak-one.vercel.app)
- [ ] Preview-URL ist verfügbar (post-messe-*.vercel.app)
- [ ] Keine unerwarteten Deployments auf Production

**Während Messe:**

- [ ] Nur Commits auf `post-messe`
- [ ] Master bleibt unverändert
- [ ] Production-Deployment unverändert
- [ ] Preview-Deployments funktionieren

**Nach Messe:**

- [ ] Merge `post-messe` → `master`
- [ ] Production-Deployment updated
- [ ] Tests auf Production
- [ ] Cleanup von Feature-Branches

## 📝 Commit auf post-messe

```bash
# Immer auf post-messe entwickeln
git checkout post-messe

# Normal arbeiten
git add .
git commit -m "FEATURE: Description"
git push origin post-messe

# Vercel erstellt automatisch Preview
```

## 🔄 Nach der Messe: Merge zu Production

```bash
# Wenn Messe erfolgreich abgeschlossen
git checkout master
git merge post-messe --no-ff -m "RELEASE: Post-Messe Features merged to Production"
git push origin master

# Vercel deployt automatisch neue Production-Version
```

## 📚 Dokumentation

- **Branch-Strategie:** [POST-MESSE-DEVELOPMENT.md](POST-MESSE-DEVELOPMENT.md)
- **Deployment-Config:** [vercel.json](vercel.json)
- **Workflow:** Dieser Guide

---

**Stand:** 15. Januar 2026, 2 Commits auf post-messe  
**Production:** Sicher & Stabil ✅  
**Development:** Entkoppelt & Flexibel ✅
