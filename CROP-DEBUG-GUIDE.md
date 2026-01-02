# 🔍 Crop Mismatch Debug Guide

## Problem

UI zeigt scale=1.5, aber generierte Bilder zeigen anderen Ausschnitt.
Verdacht: Hardcoded values (z.B. 1.7) oder falsches Offset-Paar verwendet.

## Lösung: Smoking-Gun Logs

Vollständiges Logging über die gesamte Pipeline installiert (Commit 005ec23).

---

## 🔥 Smoking-Gun Test (2 Minuten)

### Schritte:

1. **Öffne Admin** → Produkt bearbeiten
2. **Setze exakt:**
   - Scale: **1.5** (nicht 1.7!)
   - x: **-35**
   - y: **-117**
3. **Speichern**
4. **Öffne Vercel Function Logs** → Filter auf Produkt-ID
5. **Prüfe Log-Sequenz:**

```
📥 API_INCOMING_CROP
  → incoming.scale = 1.5 ✅

💾 DB_CROP_STATE  
  → db.scale = 1.5 ✅

⚙️ PIPELINE_CROP_USED
  → scaleUsed = 1.5 ✅
  → scaleSource = "db" ✅

🔥 [HARD ASSERTION]
  → SCALE_APPLIED: ✅ PASS
```

### ❌ BUG-INDIKATOR:

Wenn **irgendwo 1.7 erscheint** → Hardcoded value gefunden!

Wenn **scaleSource = "default"** → DB-Wert wird ignoriert!

---

## Log-Struktur

### A) `🎨 UI_DEBUG_CROP` (Browser Console)

Zeigt was UI tatsächlich anzeigt und speichert:

```javascript
{
  timestamp: "2026-01-02T...",
  event: "drag" | "zoom" | "save",
  uiScaleShown: 1.5,           // Slider value
  uiX: -35,                    // Overlay x
  uiY: -117,                   // Overlay y
  uiDx: 15,                    // Drag delta
  uiDy: -20,                   // Drag delta
  transformString: "...",      // Actual CSS transform
  refW: 400,                   // Viewport width
  refH: 500,                   // Viewport height
  imageNaturalW: 1920,
  imageNaturalH: 1440,
  offsetPairUsedForTransform: "xy+delta",
  payloadToSave: { scale: 1.5, x: -35, y: -117 }
}
```

**Aktivierung:** `showDebug={true}` im CroppedImage-Component

---

### B) `📥 API_INCOMING_CROP` (Vercel Logs)

Zeigt was vom Client zum Server gesendet wird:

```javascript
{
  requestId: "req_1735849200_abc123",
  productId: "uuid-...",
  incoming: {
    scale: 1.5,
    x: -35,
    y: -117,
    dx: undefined,   // future: drag deltas
    dy: undefined,
    nx: undefined,   // future: normalized
    ny: undefined
  },
  timestamp: "2026-01-02T..."
}
```

**Location:** `pages/api/admin/products/[id].js` Line ~65

---

### C) `💾 DB_CROP_STATE` (Vercel Logs)

Zeigt was aus DB gelesen wird:

```javascript
{
  productId: "uuid-...",
  db: {
    scale: 1.5,
    x: -35,
    y: -117,
    dx: null,
    dy: null,
    nx: null,
    ny: null
  },
  timestamp: "2026-01-02T..."
}
```

**Location:** `generate-thumbnail.js` Line ~105

---

### D) `⚙️ PIPELINE_CROP_USED` (Vercel Logs)

Zeigt was **tatsächlich in sharp.extract() verwendet wird**:

```javascript
{
  productId: "uuid-...",
  size: "shop",
  scaleUsed: 1.5,
  scaleSource: "db",          // ✅ "db" ist korrekt!
  offsetUsed: { x: -35, y: -117 },
  offsetSource: "db",         // ✅ "db" ist korrekt!
  refWH_used: "NO - offsets in 900×1125 reference space",
  origWH: { origW: 1920, origH: 1440 },
  baseWH: { baseW: 1152, baseH: 1440 },
  cropWH: { cropW: 768, cropH: 960 },
  offsetOrig: {
    offsetX: -29.87,
    calculation: "x*1.28/1.5 = -35*1.28/1.5 = -29.87"
  },
  position: { left: 354, top: 210 },
  clamped: false
}
```

**Location:** `generate-thumbnail.js` Line ~150

**KRITISCH:** 
- `scaleSource` MUSS "db" sein (nicht "default")
- `offsetSource` MUSS "db" sein (nicht "default")

---

## 🎯 Erwartete Ausgabe (Erfolgsfall)

```
📥 API_INCOMING_CROP
  incoming.scale = 1.5

💾 DB_CROP_STATE
  db.scale = 1.5

⚙️ PIPELINE_CROP_USED
  scaleUsed = 1.5
  scaleSource = "db"
  offsetSource = "db"

🔥 [HARD ASSERTION - SCALE CHECK]
  expectedWidth = 768
  actualCropRect.width = 768
  assertion.SCALE_APPLIED = ✅ PASS
```

---

## ❌ Fehlerfall Beispiele

### Beispiel 1: Hardcoded Scale

```
📥 API_INCOMING_CROP
  incoming.scale = 1.5 ✅

⚙️ PIPELINE_CROP_USED
  scaleUsed = 1.7 ❌        // BUG: Hardcoded!
  scaleSource = "default"  // BUG: Ignoriert DB!
```

**Fix:** Entferne hardcoded `1.7` aus Pipeline-Code.

---

### Beispiel 2: Falsches Offset-Paar

```
🎨 UI_DEBUG_CROP
  uiX = -35
  uiDx = 15
  offsetPairUsedForTransform = "dx/dy" ❌  // BUG!
  payloadToSave = { x: -35 }              // Aber speichert x!
```

**Fix:** UI muss konsistent ein Offset-Paar verwenden.

---

### Beispiel 3: Reference Space Confusion

```
⚙️ PIPELINE_CROP_USED
  refWH_used = "YES - 400×500" ❌  // BUG!
  // Server darf NICHT DOM-Viewport verwenden!
```

**Fix:** Server muss **immer 900×1125** reference space verwenden.

---

## 🎨 Debug Dashboard

Öffne: `/debug/images`

### 🔥 Smoking-Gun Section

Rote Box mit Step-by-Step Anleitung:
1. Set scale=1.5
2. Set x=-35, y=-117
3. Save
4. Check logs
5. If 1.7 appears → BUG

### ✅ Invariant Tests

Grüne Box wenn alle Tests PASS:
- **Invariant I:** Zoom works (width_B ≈ width_A / 1.7)
- **Invariant II:** Offsets don't change size (width_C == width_B)
- **Invariant III:** Direction correct (x<0 → left↓)

---

## 🔧 Fixes (Next Steps)

### Single Source of Truth

**Regel:** Server nimmt **NUR** DB-Werte (oder **NUR** incoming - aber konsistent!).

```javascript
// ✅ CORRECT:
const scaleUsed = crop?.scale || 1.0;  // DB → default
const source = crop?.scale !== undefined ? 'db' : 'default';

// ❌ WRONG:
const scaleUsed = 1.7;  // Hardcoded!
```

### Validator Fix

**Regel:** Validator darf **NIE** hardcoded values verwenden.

```javascript
// ✅ CORRECT:
const testScale = product.image_crop_scale || 1.0;

// ❌ WRONG:
const testScale = 1.7;  // Hardcoded for "zoom test"!
```

### Normalized Offsets (Future)

Speichere normalisierte Werte statt Pixel:

```javascript
// UI saves:
nx = dx / baseW    // 0.0 to 1.0
ny = dy / baseH

// Server reconstructs:
offsetX = (nx * baseW) / scale
offsetY = (ny * baseH) / scale
```

**Vorteil:** Unabhängig von UI-Viewport-Größe!

---

## ✅ Acceptance Criteria

Nach Fix MUSS gelten:

1. ✅ UI scale=1.5 → API scale=1.5 → DB scale=1.5 → PIPELINE scale=1.5
2. ✅ `scaleSource = "db"` (nicht "default")
3. ✅ `offsetSource = "db"` (nicht "default")
4. ✅ Keine hardcoded 1.7 mehr in Logs
5. ✅ Preview = Shop = Thumb (pixelgenau ±2px)

---

## 📋 Log-Checkliste

Beim Test-Run MÜSSEN diese Logs erscheinen:

- [ ] `🎨 UI_DEBUG_CROP` in Browser Console (wenn showDebug=true)
- [ ] `📥 API_INCOMING_CROP` in Vercel Function Logs
- [ ] `💾 DB_CROP_STATE` in Vercel Function Logs  
- [ ] `⚙️ PIPELINE_CROP_USED` in Vercel Function Logs (2x: shop + thumb)
- [ ] `🔥 [HARD ASSERTION]` mit `✅ PASS`

---

## 🚨 Wenn Logs fehlen

### UI_DEBUG_CROP fehlt
→ `showDebug={true}` nicht gesetzt in CroppedImage

### API_INCOMING_CROP fehlt
→ Save-Request kommt nicht an oder nutzt andere API Route

### DB_CROP_STATE fehlt
→ Pipeline wird nicht ausgeführt (thumbs nicht regeneriert)

### PIPELINE_CROP_USED fehlt
→ generate-thumbnail.js wird nicht aufgerufen

---

## 📖 Related Files

- **UI Logging:** `components/CroppedImage.jsx` Line ~75
- **API Logging:** `pages/api/admin/products/[id].js` Line ~65
- **DB Logging:** `pages/api/admin/products/generate-thumbnail.js` Line ~105
- **Pipeline Logging:** `pages/api/admin/products/generate-thumbnail.js` Line ~150
- **Dashboard:** `pages/debug/images.js` (Smoking-Gun Section)
- **Crop Math:** `lib/crop-utils.js` (computeCropRectOriginalPx)

---

## 🎯 Goal

**Before:** UI zeigt 1.5, Server nutzt 1.7 → Crop mismatch

**After:** UI zeigt 1.5, Server nutzt 1.5 → Perfect match ✅

**Metric:** All logs show **identical scale value** + **source="db"**
