# Crop System Testing Guide

Dieses Dokument beschreibt alle Akzeptanztests für das deterministische Crop-System.

---

## Voraussetzungen

1. **Dev Environment läuft:**
   ```bash
   npm run dev
   ```
   Server auf http://localhost:3000

2. **Supabase Connection funktioniert:**
   - `.env.local` korrekt konfiguriert
   - `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt

3. **Test-Produkte existieren:**
   - Mindestens 2-3 aktive Produkte mit Bildern
   - Alle haben `shop_image_path` und `thumb_path` (ggf. backfill laufen lassen)

---

## Test Suite 1: Pixel-Identical Previews

**Ziel:** Editor = Admin Preview = Shop = Thumbnails (pixel-identisch)

### Test 1.1: Editor vs. Shop Preview (Admin)

**Schritte:**
1. Admin → Produkte → "Bearbeiten" (beliebiges Produkt)
2. Crop einstellen: 
   - Zoom auf 1.5
   - Bild nach oben-links verschieben (drag)
3. **NICHT SPEICHERN** - nur anschauen:
   - Editor Preview (großes Bild oben) zeigt Crop
   - "Shop Vorschau" (unten) zeigt **WARNUNG** (noch nicht gespeichert)
4. **SPEICHERN** klicken
5. **Nach Save:**
   - Shop Vorschau Label wird: "✓ Server-generiert (exakt wie im Shop)"
   - Shop Vorschau zeigt **exakt denselben** Crop wie Editor

**Erwartung:**
- ✅ Editor Preview = Shop Preview (pixel-identical nach Save)
- ✅ Kein visueller Unterschied erkennbar

**Wie testen:**
- Screenshot Editor Preview (vor Save)
- Screenshot Shop Preview (nach Save)
- Pixel-Vergleich: Beide identisch (außer Skalierung)

---

### Test 1.2: Admin Preview vs. Shop Live

**Schritte:**
1. Admin → Produkt bearbeiten → Crop ändern → Speichern
2. Neue Tab: http://localhost:3000/shop
3. Produkt-Karte im Shop suchen

**Erwartung:**
- ✅ Shop-Karte zeigt **exakt denselben** Crop wie Admin Shop Preview
- ✅ Kein visueller Unterschied (Bildausschnitt identisch)

**Debugging (falls nicht identisch):**
- Console öffnen → Network tab
- Shop-Bild URL prüfen: Sollte `derived/<id>/shop_<hash>.webp` sein
- Falls `products/<id>/original.jpg`: ❌ FEHLER - kein shop_image_path generiert
- Response Headers prüfen: ETag sollte neu sein (kein 304 Not Modified)

---

### Test 1.3: Shop vs. Thumbnail (Admin List)

**Schritte:**
1. Shop → Produkt-Karte ansehen (z.B. Glashalter)
2. Admin → Produkte (List View)
3. Thumbnail des gleichen Produkts ansehen

**Erwartung:**
- ✅ Thumbnail zeigt **denselben Bildausschnitt** wie Shop-Karte (nur kleiner)
- ✅ Zoom/Position identisch (nicht neu centered)

**Wie testen:**
- Screenshot Shop-Karte: 900x1125
- Screenshot Thumbnail: 240x300
- Beide skalieren auf gleiche Größe → visuell vergleichen

---

## Test Suite 2: No Cross-Contamination

**Ziel:** Saving Product A NEVER affects Product B/C

### Test 2.1: Edit Product A, Check Product B

**Schritte:**
1. Shop öffnen → Alle Produkte notieren (Bildausschnitte merken)
2. Admin → Edit **Product A** (z.B. Glashalter)
3. Crop stark ändern:
   - Zoom auf 2.0 (maximal)
   - Nach oben-rechts verschieben
4. Save
5. Console prüfen: `💾 [Admin] Save payload crop:` sollte nur productId von **A** enthalten
6. Shop neu laden
7. **Product B und C** prüfen: 
   - Bildausschnitte unverändert?
   - Keine neuen Hashes in URLs?

**Erwartung:**
- ✅ Nur Product A hat neuen Crop
- ✅ Product B/C **exakt** wie vorher (keine Pixel-Veränderung)
- ✅ URLs von B/C unverändert (gleicher Hash + Timestamp)

**Debugging (falls B/C sich ändern):**
- ❌ FEHLER: Hash-Collision oder globaler State Bug
- Console: Nach Logs für Product B/C IDs suchen
- DB prüfen: `SELECT id, image_crop_scale, shop_image_path FROM products` → B/C sollten alte Werte haben

---

### Test 2.2: Multiple Concurrent Edits

**Schritte:**
1. Tab 1: Admin → Edit Product A
2. Tab 2: Admin → Edit Product B
3. Tab 1: Change Crop A → Save
4. Tab 2: Change Crop B → Save (ohne vorher zu reloaden)
5. Shop → Check both products

**Erwartung:**
- ✅ Beide Produkte haben IHRE eigenen neuen Crops
- ✅ Keine gegenseitige Überschreibung

**Hinweis:** Aktuelles System hat kein Conflict-Detection. Last-write-wins.

---

## Test Suite 3: No Stale State

**Ziel:** Save always uses CURRENT crop (not 1 step behind)

### Test 3.1: Rapid Crop Changes

**Schritte:**
1. Admin → Edit Product
2. Crop ändern: Zoom 1.2, x=-20
3. **SOFORT** nochmal ändern: Zoom 1.8, x=40 (NICHT warten!)
4. **SOFORT** Save klicken
5. Console prüfen: `💾 [Admin] Save payload crop:`

**Erwartung:**
- ✅ Payload zeigt **letzte** Änderung: `{scale: 1.8, x: 40, ...}`
- ✅ NICHT: `{scale: 1.2, x: -20}` (das wäre stale state)

**Debugging:**
- Falls stale: latestCropRef nicht korrekt aktualisiert
- Fix: Prüfe handleCropChange → latestCropRef.current Update

---

### Test 3.2: Immediate Shop Update

**Schritte:**
1. Admin → Edit Product → Change Crop → Save
2. **SOFORT** (< 1 Sekunde) Shop neu laden (F5)
3. Produkt-Karte ansehen

**Erwartung:**
- ✅ Neuer Crop **sofort** sichtbar (nicht 1 step behind)
- ✅ URL hat neuen Hash

**Debugging (falls alter Crop):**
- ❌ Browser Cache: Hard refresh (Ctrl+Shift+R)
- ❌ CDN Cache: Check Response Headers (should be `no-cache` or new ETag)
- ❌ Supabase Storage Cache: URL sollte neue Timestamp haben

---

## Test Suite 4: Cache-Busting

**Ziel:** New crop = New URL = No stale cached images

### Test 4.1: Admin Preview Cache-Busting

**Schritte:**
1. Admin → Edit Product → Save (crop beliebig)
2. Response beobachten: `shop_image_path` notieren
3. Crop **nochmal** ändern → Save
4. Response: Neuer `shop_image_path`?

**Erwartung:**
- ✅ Neuer Hash ODER neue Timestamp in URL
- ✅ Browser lädt neue Datei (Network: 200, nicht 304)
- ✅ Admin Shop Preview zeigt `?v=<new-timestamp>` Query Param

**Debugging:**
- Network Tab → Filter by `.webp`
- Status sollte sein: `200 OK` (nicht `304 Not Modified`)
- Response Headers: `ETag` sollte neu sein

---

### Test 4.2: Shop Browser Cache

**Schritte:**
1. Shop → Produkt ansehen (Bild-URL notieren)
2. Admin → Edit Product → Crop ändern → Save
3. Shop → **Hard Refresh** (Ctrl+Shift+R)
4. Bild-URL erneut notieren

**Erwartung:**
- ✅ Neue URL (unterschiedlicher Hash/Timestamp)
- ✅ Neues Bild wird geladen (kein altes cached Bild)

**Debugging (falls altes Bild):**
- ❌ Soft Refresh (F5) nutzt Browser Cache → Ctrl+Shift+R stattdessen
- ❌ Service Worker cacht aggressiv → DevTools → Application → Clear Storage

---

## Test Suite 5: Deterministic Output

**Ziel:** Same crop input = Same visual output (always)

### Test 5.1: Re-generate Same Crop

**Schritte:**
1. Admin → Edit Product
2. Set crop: Zoom 1.5, x=-30, y=20
3. Save → shop_image_path notieren
4. Crop **ändern** (z.B. 1.8, x=0, y=0)
5. Save
6. Crop **zurück** ändern auf: 1.5, x=-30, y=20
7. Save → shop_image_path notieren

**Erwartung:**
- ✅ Hash ist identisch (gleiche crop Werte = gleicher Hash)
- ✅ ABER: Timestamp ist neu (neues File generiert)
- ✅ Visuelles Ergebnis: Pixel-identisch zu Schritt 3

**Debugging:**
- Falls Hash unterschiedlich: generateCropHash Funktion prüfen
- Falls visuell unterschiedlich: computeCoverTransform nicht deterministisch (BUG!)

---

### Test 5.2: Guards Against Invalid Input

**Schritte:**
1. Browser Console öffnen
2. Admin → Edit Product → Open DevTools
3. In Console: 
   ```js
   // Hack crop state to invalid values
   document.querySelector('input[type="range"]').value = 'NaN'
   document.querySelector('input[type="range"]').dispatchEvent(new Event('change'))
   ```
4. Save

**Erwartung:**
- ✅ KEINE Errors in Console (Guards fangen invalid ab)
- ✅ Crop wird ersetzt durch default: `{scale: 1.0, x: 0, y: 0}`
- ✅ KEIN Thumbnail mit `transform: scale(NaN)` generiert

**Debugging:**
- Falls Error: sanitizeCropState() prüfen
- Falls NaN im Transform: isValidCropState() Guard fehlt

---

## Test Suite 6: ResizeObserver Stability

**Ziel:** No getBoundingClientRect errors

### Test 6.1: Rapid Tab Switching

**Schritte:**
1. Admin → Edit Product (Cropper geladen)
2. **Schnell** Tab wechseln (Ctrl+Tab)
3. **Zurück** (Ctrl+Shift+Tab)
4. Repeat 5x schnell
5. Console prüfen

**Erwartung:**
- ✅ Keine Errors: `getBoundingClientRect of null`
- ✅ ResizeObserver bleibt stabil (keine crashes)

**Debugging:**
- Falls Error: ProductImage.jsx → ResizeObserver Cleanup prüfen
- Guard sollte sein: `if (!containerRef.current?.getBoundingClientRect) return;`

---

### Test 6.2: Component Unmount

**Schritte:**
1. Admin → Edit Product (Cropper geladen)
2. Browser DevTools → React DevTools
3. ProductImage Component finden
4. **Unmount** (z.B. zurück zur Product List navigieren)
5. Console prüfen

**Erwartung:**
- ✅ ResizeObserver cleanup läuft
- ✅ Keine Memory Leaks (keine Warnings in DevTools)

---

## Test Suite 7: E2E User Flow

**Ziel:** Realistischer End-to-End Flow

### Szenario: Neues Produkt mit Crop

**Schritte:**
1. **Upload:**
   - Admin → Produkte → "Neues Produkt"
   - Name: "Test Widget"
   - Bild hochladen: `test-image.jpg` (2000x1500)
   - Save (ohne Crop zu ändern)

2. **Verify Default:**
   - Shop → "Test Widget" sollte centered crop haben (zoom 1.0)

3. **Edit Crop:**
   - Admin → Edit "Test Widget"
   - Zoom: 1.6
   - Drag: nach oben-rechts
   - Save

4. **Verify in Shop:**
   - Shop reload → Produkt zeigt neuen Crop

5. **Edit Again:**
   - Admin → Edit "Test Widget"
   - Zoom: 1.2 (weniger zoom)
   - Drag: nach unten-links
   - Save

6. **Verify Immediate Update:**
   - Shop reload → Crop updated (nicht 1 step behind)

**Erwartung:**
- ✅ Jeder Schritt funktioniert
- ✅ Keine Errors
- ✅ Shop zeigt immer aktuellsten Crop

---

## Debugging Checklist

Falls Tests fehlschlagen:

### ❌ Preview nicht identisch
- [ ] Console: `computeCoverTransform` Debug-Output prüfen
- [ ] Network: Beide Previews laden gleiche URL?
- [ ] Code: Beide nutzen `computeCoverTransform()` (nicht manuelles CSS)?

### ❌ Cross-Contamination (Product B ändert sich)
- [ ] DB: `SELECT * FROM products WHERE id = '<B-id>'` → crop Werte gleich wie vorher?
- [ ] Code: `generateCropHash()` enthält `productId`?
- [ ] Code: React setState immutable? (`setProducts([...data])`)

### ❌ Stale State (1 step behind)
- [ ] Code: `handleSubmit` liest von `latestCropRef.current`?
- [ ] Console: Save payload zeigt **aktuelle** crop Werte?
- [ ] Code: `handleCropChange` aktualisiert `latestCropRef.current` sofort?

### ❌ Cache-Busting funktioniert nicht
- [ ] Network: Response ist 200 (nicht 304)?
- [ ] URL: Hat neuen Hash/Timestamp?
- [ ] Browser: Hard Refresh (Ctrl+Shift+R) statt Soft?

### ❌ getBoundingClientRect Error
- [ ] Code: ProductImage.jsx → ResizeObserver guards aktiv?
- [ ] Code: `if (!containerRef.current) return;` vor jedem `.getBoundingClientRect()`?
- [ ] DevTools: Component ist mounted wenn Observer triggert?

---

## Acceptance Criteria (Final Sign-off)

**System ist produktionsreif wenn:**

- ✅ **Test Suite 1** (Pixel-Identical): ALLE Tests bestanden
- ✅ **Test Suite 2** (No Cross-Contamination): ALLE Tests bestanden
- ✅ **Test Suite 3** (No Stale State): ALLE Tests bestanden
- ✅ **Test Suite 4** (Cache-Busting): ALLE Tests bestanden
- ✅ **Test Suite 5** (Deterministic): ALLE Tests bestanden
- ✅ **Test Suite 6** (ResizeObserver): ALLE Tests bestanden
- ✅ **Test Suite 7** (E2E): Komplett durchlaufen ohne Errors

**Additional Checks:**

- ✅ Dokumentation vollständig (CROP-MODEL-DOCUMENTATION.md)
- ✅ Code-Comments für kritische Guards/Logik
- ✅ Console.logs entfernt oder auf DEBUG-Mode beschränkt
- ✅ Migration für bestehende Produkte ausgeführt (backfill-thumbnails.js)
- ✅ Supabase Storage: Alte derived/ Files bereinigt (optional)

---

## Performance Testing (Optional)

**Thumbnail Generation Speed:**
```bash
time node scripts/backfill-thumbnails.js
```
Erwartung: < 5 Sekunden für 4 Produkte (mit Sharp)

**Shop Load Time:**
```
Open DevTools → Network → Reload Shop
Check: DOMContentLoaded < 1s
Check: All images load < 3s (with Supabase Storage)
```

---

## Known Limitations

**NOT Covered by Tests:**
1. **CDN Caching:** Falls Supabase Storage CDN nutzt, kann es bis zu 1 Minute dauern bis neue Bilder propagieren
2. **Browser Compatibility:** Tests nur in modernen Chrome/Firefox (ResizeObserver Support required)
3. **Concurrent Saves:** Last-write-wins (kein Optimistic Locking)
4. **Large Images:** Thumbnails für 10MB+ Images können > 5s dauern

**Acceptable Trade-offs:**
- Editor Preview nutzt CSS transform (Performance) → Shop nutzt server-crop (Determinismus)
- Alte derived/ Files werden NICHT auto-gelöscht (manual cleanup nötig)
- Crop-History gibt es nicht (nur current state)
