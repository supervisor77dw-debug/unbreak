# 🧪 TEST-ANLEITUNG: Crop-Editor Debug & Funktionalität

## ✅ Nach Migration & Deploy durchführen

---

## 1️⃣ Vorbereitung

### Migration ausführen (falls noch nicht geschehen):
```bash
node run-supabase-migration.js
```
→ SQL in Supabase Dashboard einfügen

### Warten auf Vercel Deploy:
- https://vercel.com/dashboard
- Warte bis "Ready" steht
- Öffne: https://unbreak-one.vercel.app

---

## 2️⃣ Browser-Console öffnen (WICHTIG!)

### In Chrome/Edge:
- **F12** drücken
- Tab "Console" auswählen
- **Offen lassen während Tests!**

### Erwartete Logs:
```
🖱️ Drag START: {x: 0, y: 0}
🖱️ Drag MOVE: {newX: 15, newY: -8}
📐 Crop changed: {scale: 1, x: 15, y: -8}
```

---

## 3️⃣ Admin Edit öffnen

### URL:
https://unbreak-one.vercel.app/admin/products

### Login:
- Email: (deine Admin-Email)
- Password: (dein Passwort)

### Produkt bearbeiten:
- Wähle ein Produkt mit Bild
- Klicke "Bearbeiten"

---

## 4️⃣ TEST A: Bild hochladen

### Schritt 1: Bild auswählen
- Klicke "Datei auswählen"
- Wähle ein Produktbild (JPEG/PNG)

### Erwartung:
✅ Preview erscheint im **4:5 Format**
✅ Label zeigt: **"Shop-Vorschau (4:5)"**
✅ Crop-Editor erscheint darunter

### Console-Log Check:
```
🔄 Image loaded
```

---

## 5️⃣ TEST B: Drag im Bild

### Schritt 1: Maus über Preview
- Cursor sollte sich zu **"grab" Hand-Symbol** ändern

### Schritt 2: Drag testen
- **Klicke und halte** auf dem Bild
- **Ziehe** nach links/rechts/oben/unten
- Cursor wird zu **"grabbing"**

### Erwartung:
✅ Bild verschiebt sich während Drag
✅ Position-Anzeige ändert sich (X=... Y=...)

### Console-Log Check:
```
🖱️ Drag START: {x: 0, y: 0}
🖱️ Drag MOVE: {newX: 25, newY: -15}
🖱️ Drag MOVE: {newX: 32, newY: -20}
📐 Crop changed: {scale: 1, x: 32, y: -20}
🖱️ Drag END
```

### ❌ Wenn kein Log erscheint:
```
🚫 Drag disabled: {interactive: false, hasCallback: false}
```
→ Props werden nicht korrekt übergeben!

---

## 6️⃣ TEST C: Pfeil-Buttons

### Schritt 1: Pfeil nach oben (▲)
- Klicke auf **▲** Button

### Erwartung:
✅ Bild verschiebt sich nach **oben** (10px)
✅ Y-Wert wird **kleiner** (z.B. Y=-10)

### Console-Log Check:
```
⬆️ Arrow move: up
📐 Crop changed: {scale: 1, x: 0, y: -10}
```

### Schritt 2: Alle Pfeile testen
- **▼** → Bild nach unten (Y wird größer)
- **◀** → Bild nach links (X wird kleiner)
- **▶** → Bild nach rechts (X wird größer)

### ❌ Wenn Button nichts macht:
- **Kein Console-Log?** → onClick wird nicht gefeuert
- **Log aber kein Effekt?** → State-Update funktioniert nicht

---

## 7️⃣ TEST D: Zoom-Slider

### Schritt 1: Slider bewegen
- **Ziehe Slider** nach rechts (von 1.0 zu 2.5)

### Erwartung:
✅ Bild wird **größer** (Zoom)
✅ Anzeige zeigt: **"Zoom: 1.45x"** (aktueller Wert)

### Console-Log Check:
```
🔍 Zoom changed: 1.45
📐 Crop changed: {scale: 1.45, x: 0, y: 0}
```

### Test Extremwerte:
- **1.0x** → Kein Zoom (Standardgröße)
- **2.5x** → Maximaler Zoom

---

## 8️⃣ TEST E: Reset-Button

### Schritt 1: Crop verändern
- Zoom auf 1.8
- Drag nach rechts (X=50)
- Drag nach oben (Y=-30)

### Schritt 2: Reset klicken
- Klicke **"↻ Zurücksetzen"**

### Erwartung:
✅ Zoom: **1.0x**
✅ Position: **X=0 Y=0**
✅ Bild in Original-Position

### Console-Log Check:
```
↻ Reset crop
📐 Crop changed: {scale: 1, x: 0, y: 0}
```

---

## 9️⃣ TEST F: Speichern & Persistenz

### Schritt 1: Crop einstellen
- Zoom: **1.5x**
- X: **30**
- Y: **-20**

### Schritt 2: Speichern
- Klicke **"Aktualisieren"** oder **"Erstellen"**
- Warte auf Erfolg-Meldung

### Schritt 3: Seite neu laden (F5)
- **Komplett neu laden!**

### Erwartung:
✅ Crop-Werte sind **erhalten**:
  - Zoom: 1.5x
  - X: 30
  - Y: -20
✅ Preview zeigt **exakt gleichen Ausschnitt**

### ❌ Wenn Werte zurück auf 1.0/0/0:
→ DB speichert nicht! Check:
1. Supabase Table Editor → products
2. Spalten image_crop_scale, image_crop_x, image_crop_y vorhanden?
3. Werte gespeichert?

---

## 🔟 TEST G: Shop-Ansicht

### Schritt 1: Shop öffnen
https://unbreak-one.vercel.app/shop

### Erwartung:
✅ Produkt zeigt **gleichen Crop** wie im Admin
✅ Format ist **4:5** (Hochkant)
✅ Kein Text-Overlay auf Bild

### Vergleich:
- Admin Preview Crop: scale=1.5, x=30, y=-20
- Shop Card: **identischer Ausschnitt**

---

## 📊 ZUSAMMENFASSUNG: Was muss funktionieren?

| Feature | Status | Log |
|---------|--------|-----|
| **Drag mit Maus** | ✅ Bild bewegt sich | `🖱️ Drag MOVE` |
| **Pfeil-Buttons** | ✅ 10px Steps | `⬆️ Arrow move` |
| **Zoom-Slider** | ✅ 1.0-2.5 | `🔍 Zoom changed` |
| **Reset** | ✅ Zurück zu 1.0/0/0 | `↻ Reset crop` |
| **Speichern** | ✅ Persistiert in DB | - |
| **Reload** | ✅ Werte bleiben | - |
| **Shop = Admin** | ✅ Identischer Crop | - |
| **Format 4:5** | ✅ Überall Hochkant | - |

---

## 🚨 FEHLER-DIAGNOSE

### Problem: Drag funktioniert nicht

**Check 1: Console-Log**
```
🚫 Drag disabled: {interactive: false, hasCallback: false}
```
→ `interactive` oder `onCropChange` fehlt in Props!

**Check 2: Element Inspector**
- Rechtsklick auf Preview → "Inspect"
- Suche `<div class="product-image-container"`
- Hat es `style="cursor: grab"`?
- Wenn NEIN → Props werden nicht übergeben

**Fix:**
- ProductForm muss `interactive={true}` setzen
- ProductForm muss `onCropChange={handleCropChange}` setzen

---

### Problem: Buttons machen nichts

**Check 1: onClick feuert?**
```javascript
// Kein Log erscheint → Button disabled oder Event blockiert
⬆️ Arrow move: up // ← Das MUSS kommen!
```

**Check 2: DevTools Elements**
- Ist Button `disabled="true"`?
- Ist Button hinter anderem Element (`z-index`)?

---

### Problem: Werte nicht gespeichert

**Check: Supabase Table**
1. Dashboard → Table Editor → products
2. Spalten vorhanden?
   - `image_crop_scale` (real)
   - `image_crop_x` (int4)
   - `image_crop_y` (int4)

**Wenn NEIN:**
→ Migration nicht ausgeführt!
→ Siehe `run-supabase-migration.js`

---

## ✅ ERFOLGS-KRITERIUM

**Alle 8 Tests bestanden:**
1. ✅ Preview im 4:5 Format
2. ✅ Drag funktioniert (Console-Logs)
3. ✅ Pfeile bewegen Bild
4. ✅ Zoom-Slider wirkt
5. ✅ Reset funktioniert
6. ✅ Speichern persistiert
7. ✅ Reload behält Werte
8. ✅ Shop zeigt gleichen Crop

**→ System ist produktionsbereit! 🚀**
