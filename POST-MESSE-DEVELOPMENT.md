# Post-Messe Development Branch

**Branch:** `post-messe`  
**Erstellt:** 15. Januar 2026  
**Basis:** master @ commit `7a087a9`

## 🔒 Production Freeze

Der `master` Branch ist **eingefroren** und repräsentiert den stabilen Messe-Stand:
- Datum: 14./15. Januar 2026
- Letzter Commit: `7a087a9` (DEPRECATE /admin/pricing)
- Status: **PRODUCTION - NICHT VERÄNDERN**

## 🌱 Entwicklungszweig

Dieser Branch (`post-messe`) dient der **Weiterentwicklung nach der Messe**:
- Alle neuen Features
- Bugfixes (nicht-kritisch)
- Refactoring
- Optimierungen

## 🚀 Deployment-Strategie

### Vercel Deployments:
```
master       → Production Deployment (unbreak-one.vercel.app)
post-messe   → Preview Deployment (post-messe-*.vercel.app)
```

### Workflow:
1. **Entwicklung:** Alle Commits auf `post-messe`
2. **Testing:** Preview-Deployment in Vercel
3. **Release:** Nach Messe → Merge `post-messe` → `master`

## ⚠️ Wichtige Regeln

**NIEMALS auf master committen während der Messe!**
- Master ist eingefroren bis Messe-Ende
- Alle Änderungen NUR auf `post-messe`
- Kein Force-Push auf master
- Kein Rebase von master während Messe

**Production-Hotfixes:**
- Nur im absoluten Notfall
- Separater Branch `hotfix/...` von master
- Nach Fix: Merge zu master UND post-messe

## 📋 Geplante Features (Post-Messe)

- [ ] Performance-Optimierungen
- [ ] Analytics-Integration
- [ ] Erweiterte Admin-Features
- [ ] UI/UX-Verbesserungen
- [ ] Weitere Konfigurator-Optionen

## 🔄 Merge-Strategie (Nach Messe)

```bash
# Nach erfolgreicher Messe:
git checkout master
git merge post-messe --no-ff
git push origin master
```

---

**Messe-Stand geschützt ✅**  
**Weiterentwicklung entkoppelt ✅**  
**Kein Risiko für Live-Demo ✅**
