/**
 * CROP MODEL DOCUMENTATION - SINGLE SOURCE OF TRUTH
 * 
 * Dieses Dokument beschreibt das normalisierte Crop-Model für UNBREAK-ONE Produktbilder.
 * 
 * ZIEL: Deterministisches, reproduzierbares Crop-System für 4:5 Produktbilder
 */

## Crop Model Structure

Das Crop Model wird in der DB als separate Felder gespeichert:

```sql
-- products table
image_crop_scale FLOAT    -- User zoom: 1.0 (minimal fill) bis 2.5 (max zoom)
image_crop_x     INTEGER  -- X offset in Frame-Pixeln (z.B. -50 bis +50)
image_crop_y     INTEGER  -- Y offset in Frame-Pixeln (z.B. -50 bis +50)
```

### Normalisierung

**WICHTIG:** Die x/y Werte sind bereits normalisiert:
- Sie sind NICHT in "px des aktuellen DOM"
- Sie sind **Offsets vom Center in Frame-Pixeln** (unabhängig vom Browser)
- Sie beziehen sich auf einen **4:5 Container** (aspect ratio = 0.8)

**Beispiel:**
```js
{
  scale: 1.5,  // 1.5x Zoom über minimal fill
  x: -40,      // 40px nach links vom Center
  y: 25        // 25px nach unten vom Center
}
```

Bei einem 400x500 Container (4:5):
- Center ist bei (200, 250)
- x=-40 bedeutet: Bild-Center wird bei (160, 250) positioniert
- y=25 bedeutet: Bild-Center wird bei (200, 275) positioniert

---

## Transform Computation - computeCoverTransform()

**Single Source of Truth:** `lib/crop-utils.js::computeCoverTransform()`

Diese Funktion wird verwendet von:
1. **Editor Preview** (Admin Crop-Editor)
2. **Shop Preview** (Admin "So sieht's im Shop aus")
3. **ProductImage Component** (alle Rendering-Kontexte)
4. **Server-side Rendering** (generate-thumbnail API via Sharp)

### Algorithmus:

```js
computeCoverTransform({ imgW, imgH, frameW, frameH, scale, x, y })
```

**Schritt 1: Base Scale berechnen (cover-fit)**
```js
scaleToFillWidth = frameW / imgW
scaleToFillHeight = frameH / imgH
baseScale = Math.max(scaleToFillWidth, scaleToFillHeight)
```
→ Minimales Scale damit Bild Frame vollständig füllt

**Schritt 2: Effective Scale**
```js
effectiveScale = baseScale * scale  // scale = user zoom (1.0-2.5)
```

**Schritt 3: CSS Transform**
```js
transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${effectiveScale})`
```

**Transform Origin:** `center center` (default)

---

## Crop Workflow

### 1. Upload Image
```
User uploads image.jpg (z.B. 2000x1500 natural size)
↓
System saves to: products/<productId>/original.jpg
↓
DB: image_path = "products/<id>/original.jpg"
     image_crop_scale = 1.0  (default: minimal fill)
     image_crop_x = 0
     image_crop_y = 0
```

### 2. Edit Crop (Admin)
```
User adjusts crop in Admin Editor:
- Zoom slider: 1.0 → 1.8
- Drag image: x=-50, y=30
↓
Frontend: latestCropRef.current = { scale: 1.8, x: -50, y: 30 }
↓
Click "Speichern"
↓
POST /api/admin/products/<id>
Body: { image_crop_scale: 1.8, image_crop_x: -50, image_crop_y: 30 }
```

### 3. Server-side Rendering
```
Backend (PATCH /api/admin/products/<id>):
1. Validate & Save crop to DB
2. Generate thumbnails (synchronous):
   
   For size in ['shop', 'thumb']:
     - Download original from Supabase Storage
     - Compute crop via computeCoverTransform({ imgW, imgH, frameW, frameH, scale, x, y })
     - Apply crop with Sharp:
       * Resize to effectiveScale
       * Extract crop region
       * Resize to target (900x1125 for shop, 240x300 for thumb)
     - Upload to: derived/<id>/<size>_<hash>_<timestamp>.webp
     - Save path to DB: shop_image_path, thumb_path

3. Return updated product with new paths
```

### 4. Display (Shop/Admin)
```
Shop:
- Loads product data (includes shop_image_path)
- Renders: <img src="derived/<id>/shop_<hash>_<timestamp>.webp" />
- NO CSS transform needed (already cropped!)

Admin List:
- Loads product data (includes thumb_path)
- Renders: <img src="derived/<id>/thumb_<hash>_<timestamp>.webp" />
- NO CSS transform needed

Admin Editor Preview:
- BEFORE Save: Uses Original + CSS transform (computeCoverTransform)
- AFTER Save: Uses shop_image_path directly (NO transform)
- Label shows: "✓ Server-generiert (exakt wie im Shop)"
```

---

## Invariants (MUST hold)

1. **Pixel-Identical Previews:**
   ```
   Editor Preview = Admin Shop Preview = Shop Card = Admin Thumbnail (scaled)
   ```
   All use the SAME computeCoverTransform() logic.

2. **Immutable Products:**
   ```
   Saving Product A NEVER affects Product B/C
   ```
   - DB updates scoped: WHERE id = <productId>
   - React state: immutable arrays ([...data])
   - Thumbnail filenames: include productId + hash

3. **Cache-Busting:**
   ```
   New crop = New URL
   ```
   - Filename: <size>_<hash>_<timestamp>.webp
   - Hash: MD5(productId + imagePath + scale + x + y)
   - Timestamp: Date.now() on generation
   - Query param: ?v=<imageVersion> in Admin Preview

4. **No Stale State:**
   ```
   Save always uses CURRENT crop
   ```
   - latestCropRef tracks latest crop
   - handleSubmit reads from ref, not stale state

5. **Deterministic:**
   ```
   Same crop input = Same visual output (always)
   ```
   - Guards prevent NaN/Infinity
   - sanitizeCropState replaces invalid with defaults
   - computeCoverTransform is pure function

---

## Validation Guards

**Input Validation:**
```js
isFiniteNumber(n)     // n is number && finite (not NaN/Infinity)
isValidSize(size)     // width/height > 0 && finite
isValidCropState(crop) // scale > 0, x/y finite
sanitizeCropState(crop) // Replace invalid with {1.0, 0, 0}
```

**Output Validation:**
```js
computeCoverTransform returns:
{
  transform: "translate(...) scale(...)",
  baseScale: number (>= 1.0),
  effectiveScale: number (>= 1.0),
  debug: { imgSize, frameSize, scales, offset }
}
```

If inputs invalid → returns:
```js
{ transform: 'none', baseScale: 1, effectiveScale: 1 }
```

---

## Debugging

**Console Logs:**

**Save Payload:**
```
💾 [Admin] Save payload crop: {scale: 1.8, x: -50, y: 30}
```

**Save Response:**
```
✅ [Admin] Save response: {
  productId: "f1bd8e75...",
  shop_image_path: "derived/.../shop_abc123_1767301234567.webp",
  thumb_path: "derived/.../thumb_abc123_1767301234567.webp",
  crop: {scale: 1.8, x: -50, y: 30}
}
```

**Thumbnail Generation:**
```
🎨 [THUMBNAIL GEN] START: {productId, imagePath, size, crop, timestamp}
✅ [THUMBNAIL GEN] SUCCESS: {productId, size, thumbPath, url, cropHash}
```

**Shop Rendering:**
```
🛒 [Shop] Product <id> using server-crop: derived/.../shop_abc123.webp
❌ [Shop] Product <id> MISSING shop_image_path - showing placeholder
```

---

## File Structure

```
supabase/storage/product-images/
├── products/<productId>/
│   └── original_<timestamp>.jpg        # Original upload
└── derived/<productId>/
    ├── shop_<hash>_<timestamp>.webp    # 900x1125 (4:5) - for Shop cards
    └── thumb_<hash>_<timestamp>.webp   # 240x300 (4:5) - for Admin list
```

**Hash:** MD5(productId + imagePath + scale + x + y).substring(0, 8)
**Timestamp:** Date.now() on generation

---

## Testing Protocol

**Test 1: Pixel-Identical Previews**
```
1. Admin → Edit Product → Adjust Crop (zoom 1.5, x=-40, y=25)
2. Check: Editor Preview shows cropped image
3. Save
4. Check: "So sieht's im Shop aus" label changes to "✓ Server-generiert"
5. Check: Preview shows EXACT same crop (pixel-identical)
6. Open Shop → Check: Product card shows EXACT same crop
7. Admin List → Check: Thumbnail shows EXACT same crop (smaller)
```

**Test 2: No Cross-Contamination**
```
1. Edit Product A (Glashalter)
2. Change crop: zoom 1.8
3. Save
4. Check Console: Only productId for A appears in logs
5. Shop → Check: Only Product A changed, B/C unchanged
```

**Test 3: Immediate Updates (No Stale)**
```
1. Edit Product → Change crop
2. Save
3. Reload Shop immediately
4. Check: New crop visible (not 1 step behind)
```

**Test 4: Cache-Busting**
```
1. Edit Product → Change crop → Save
2. Check: New shop_image_path in response (different hash)
3. Check: Admin Preview URL has ?v=<new-timestamp>
4. Hard refresh Shop → New image loads (not cached old)
```

---

## Migration Path

**For existing products without shop_image_path/thumb_path:**

```bash
node scripts/backfill-thumbnails.js
```

This script:
1. Finds all products with `image_path` but missing `shop_image_path`
2. Generates thumbnails using existing crop_state (or default 1.0/0/0)
3. Updates DB with new paths
4. Reports success/failure

---

## Future Improvements

**Potential Enhancements:**
1. Store crop as JSON: `image_crop JSON` instead of 3 separate fields
2. Add crop history: Track previous crops for undo
3. Batch thumbnail generation: Process multiple products in parallel
4. CDN integration: Auto-invalidate CDN cache on thumbnail update
5. Crop presets: "Center", "Top", "Bottom" quick actions

**Non-Goals:**
- Auto-crop AI: Too unpredictable, manual control preferred
- Aspect ratio variations: 4:5 is enforced, no 16:9 or square
- Client-side canvas rendering: Server-side Sharp is deterministic
