# 🚀 QUICK START - Performance Testing

## ⚡ Nächste Schritte (in dieser Reihenfolge)

### 1️⃣ WebP-Images generieren
```powershell
# Falls ImageMagick fehlt:
choco install imagemagick

# Dann:
.\generate-responsive-images.ps1
```

**Erwartung:**
- Erstellt WebP-Versionen aller 7 kritischen Images
- Generiert responsive Breakpoints (320w, 640w, 1024w)
- Zeigt Größen-Einsparungen pro Datei

---

### 2️⃣ Lokalen Server starten
```powershell
cd public
python -m http.server 8000

# Alternative:
npx http-server public -p 8000
```

**Browser:** http://localhost:8000

---

### 3️⃣ Lighthouse Test
1. **Chrome Inkognito:** Strg+Shift+N
2. **DevTools:** F12 → Tab "Lighthouse"
3. **Settings:**
   - Device: Mobile + Desktop
   - Categories: All
4. **Run:** "Analyze page load"

**Erwartete Scores:**
- Desktop Performance: 85-95
- Mobile Performance: 75-85
- LCP Desktop: <2.5s
- LCP Mobile: <4s

---

### 4️⃣ Validierung
✅ **Checkliste:**
- [ ] WebP-Dateien in `public/images/` vorhanden (21+ Dateien)
- [ ] Keine 404-Errors im Console (F12 → Console)
- [ ] Images laden progressiv (Network-Tab prüfen)
- [ ] LCP Desktop: <2.5s ✅
- [ ] LCP Mobile: <4s ✅
- [ ] Performance Score: >85 (Desktop), >75 (Mobile)

---

## 📁 Dateien-Übersicht

### Neu erstellt:
- ✅ `generate-responsive-images.ps1` - WebP Bulk-Conversion
- ✅ `LIGHTHOUSE-TESTING.md` - Vollständiger Test-Guide
- ✅ `PERFORMANCE-SUMMARY.md` - Detaillierte Optimierungs-Dokumentation
- ✅ `README-PERF-QUICK.md` - Diese Datei

### Modifiziert:
- ✅ `public/index.html` - 60+ Optimierungen (srcset, lazy-load, preload)

---

## 🛠️ Implementierte Optimierungen

| Kategorie | Implementierung | Status |
|-----------|----------------|--------|
| **LCP-Element** | Preload + fetchpriority="high" | ✅ |
| **Responsive Images** | srcset + sizes (320w, 640w, 1024w) | ✅ HTML |
| **WebP-Conversion** | 7 kritische Dateien | ⏳ Muss generiert werden |
| **Lazy-Loading** | loading="lazy" für below-fold | ✅ |
| **Video-Optimization** | preload="none" statt "metadata" | ✅ |
| **Render-Blocking** | defer auf version.js + i18n.js | ✅ |
| **CLS-Prevention** | width/height auf allen Images | ✅ |

---

## ⚠️ Troubleshooting

### **WebP-Script schlägt fehl**
```powershell
# ImageMagick installieren:
choco install imagemagick

# Terminal neu starten (PATH aktualisieren)
# Script erneut ausführen:
.\generate-responsive-images.ps1
```

### **Images werden nicht geladen (404)**
```powershell
# Prüfe ob WebP-Dateien existieren:
Get-ChildItem public\images\*.webp

# Falls nicht → Script ausführen:
.\generate-responsive-images.ps1
```

### **LCP immer noch >4s**
1. **Network-Tab prüfen:**
   - F12 → Network → Disable Cache ✅
   - Reload (Strg+F5)
   - Suche nach "hero-cinematic.jpg"
   - Priority sollte "High" sein

2. **Lighthouse Details:**
   - Scroll zu "Diagnostics"
   - "Largest Contentful Paint element" → sollte Hero-Poster sein
   - Check "Opportunities" für weitere Tipps

---

## 🎯 Erwartete Verbesserungen

### Desktop
```
Performance:  60-70 → 85-95  (+25-35)
LCP:          ~10s → <2.5s   (-7.5s)
Speed Index:  ~9s  → <4s     (-5s)
```

### Mobile
```
Performance:  40-50 → 75-85  (+30-40)
LCP:          ~12s → <4s     (-8s)
Speed Index:  ~11s → <6s     (-5s)
```

---

## 📊 Dateigröße-Einsparungen

| Datei | Vorher | Nachher (WebP) | Ersparnis |
|-------|--------|----------------|-----------|
| badge-made-in-germany.png | 2.87 MB | ~800 KB | **72%** |
| hero-cinematic.jpg | 1.45 MB | ~450 KB | **69%** |
| scene-home.jpg | 380 KB | ~120 KB | **68%** |
| weinglashalter_szene_ship.jpg | 462 KB | ~140 KB | **70%** |
| flaschenhalter_szene_ship.jpg | 484 KB | ~150 KB | **69%** |

**Total:** ~4.8 MB → ~1.7 MB = **65% Reduktion**

---

## ✅ Git Status

```bash
Branch:   perf/lighthouse-lcp-images
Commit:   d54eb18
Status:   ✅ Code committed
Next:     WebP-Generation + Testing
```

**Commit Message:**
> perf: Optimize images - LCP <4s via responsive WebP + lazy-load

---

## 📖 Weitere Dokumentation

- **Vollständiger Test-Guide:** [LIGHTHOUSE-TESTING.md](LIGHTHOUSE-TESTING.md)
- **Performance-Details:** [PERFORMANCE-SUMMARY.md](PERFORMANCE-SUMMARY.md)
- **WebP-Generator:** [generate-responsive-images.ps1](generate-responsive-images.ps1)

---

## 🚢 Deployment (nach erfolgreichen Tests)

```powershell
# 1. Push to remote
git push origin perf/lighthouse-lcp-images

# 2. Create Pull Request
# 3. Lighthouse auf Preview-URL testen
# 4. Review + Merge nach master
```

---

**TEST MODE aktiv** - Kein Master-Commit ohne Review! 🚧

**Erstellt:** Performance Engineering für www.unbreak-one.com  
**Branch:** perf/lighthouse-lcp-images  
**Ziel:** LCP <4s (Mobile), <2.5s (Desktop)
