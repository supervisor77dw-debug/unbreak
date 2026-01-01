# 🚨 IMMEDIATE RECOVERY: Shop Images Missing

## Current Status
- ❌ Shop shows placeholders for ALL products (no images)
- ❌ Admin thumbnails broken/unusable  
- ❌ Root cause: `shop_image_path` and `thumb_path` columns missing in DB

---

## ⚡ STEP 1: Run Migration 007 (REQUIRED - 2 minutes)

### Copy this SQL:

```sql
-- Migration 007: Add Thumbnail Paths
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumb_path TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_image_path TEXT;

CREATE INDEX IF NOT EXISTS idx_products_thumb_path ON products(thumb_path);
CREATE INDEX IF NOT EXISTS idx_products_shop_image_path ON products(shop_image_path);

COMMENT ON COLUMN products.thumb_path IS 'Server-generiertes Thumbnail (240x300, 4:5) mit Crop';
COMMENT ON COLUMN products.shop_image_path IS 'Server-generiertes Shop-Image (900x1125, 4:5) mit Crop';
```

### Execute in Supabase:
1. Open: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Paste the SQL above
3. Click **"Run"**
4. Verify success: ✅ "Success. No rows returned"

---

## ⚡ STEP 2: Run Backfill Script (REQUIRED - 5 minutes)

This generates missing `shop_image_path` and `thumb_path` for all products.

### Command:
```bash
node scripts/backfill-thumbnails.js
```

### Expected Output:
```
🔍 [BACKFILL] Starting thumbnail backfill...

📋 Found 4 products needing thumbnails:

  - GLASS-001: Glashalter Premium
    ├─ shop_image_path: ✗ MISSING
    └─ thumb_path: ✗ MISSING

  - BOTTLE-001: Flaschenhalter Magneto
    ├─ shop_image_path: ✗ MISSING
    └─ thumb_path: ✗ MISSING

🚀 Starting regeneration...

🔧 Processing: GLASS-001 - Glashalter Premium
   Crop: scale=1, x=0, y=0
   ✅ thumb generated: derived/123/thumb_a4f7b3c2_1735689600000.webp
   ✅ shop generated: derived/123/shop_a4f7b3c2_1735689600000.webp
   ✅ DB updated

✅ Success: 4/4
```

### What it does:
1. Finds all products with `image_path` but missing `shop_image_path`/`thumb_path`
2. For each product:
   - Downloads original from Supabase Storage
   - Generates `shop` image (900x1125, 4:5 aspect ratio)
   - Generates `thumb` image (240x300, 4:5 aspect ratio)
   - Uploads to `derived/<productId>/shop_<hash>_<timestamp>.webp`
   - Updates DB with paths
3. Reports results

---

## ⚡ STEP 3: Verify Shop (1 minute)

### Open Shop:
```
https://unbreak-one.vercel.app/shop
```

### Expected Result:
- ✅ All 4 products display images (NOT placeholders)
- ✅ Images are 4:5 aspect ratio (hochkant)
- ✅ Console shows: `🛒 [Shop] Product <id> using server-crop: derived/<id>/shop_...`

### If still showing placeholders:
1. Check browser console for errors
2. Verify DB has `shop_image_path` populated:
   ```sql
   SELECT id, sku, name, shop_image_path FROM products;
   ```
3. Verify files exist in Supabase Storage → `product-images` bucket → `derived/` folder

---

## ⚡ STEP 4: Verify Admin Thumbnails (1 minute)

### Open Admin Products:
```
https://unbreak-one.vercel.app/admin/products
```

### Expected Result:
- ✅ All thumbnails display clearly (240x300)
- ✅ Recognizable product images
- ✅ Console shows (localhost only): `🔧 [Admin List] Product: {id, thumbPath, shopPath}`

---

## ⚡ STEP 5: Test Product Save (2 minutes)

### Test Isolation:
1. Admin → Products → **Glashalter** → Bearbeiten
2. Change crop: Zoom 1.5, X=30, Y=-20
3. Click **"Aktualisieren"**

### Expected Console Output:
```
🔄 [PATCH] Regenerating thumbnails for product: <GLASS-ID>
🎨 [THUMBNAIL GEN] START: {productId: "<GLASS-ID>", size: "shop", ...}
✅ [THUMBNAIL GEN] SUCCESS: {thumbPath: "derived/<GLASS-ID>/shop_<NEW-HASH>_<NEW-TIMESTAMP>.webp"}
```

### Verify:
- ✅ Only Glashalter updated (Flasche/Gastro/Wein unchanged)
- ✅ Shop shows new crop for Glashalter
- ✅ Admin list shows new thumbnail for Glashalter

---

## 📊 Verification Checklist

- [ ] Migration 007 executed in Supabase ✅
- [ ] Backfill script ran successfully (4/4 products)
- [ ] Shop shows 4 images (NO placeholders)
- [ ] Admin list shows 4 thumbnails (clear/recognizable)
- [ ] Save Product A → only Product A updates
- [ ] Console shows NO "MISSING shop_image_path" warnings
- [ ] Console shows NO `getBoundingClientRect` errors

---

## 🔍 Troubleshooting

### Problem: Backfill fails with "column does not exist"
**Solution:** Migration 007 not run yet. Go to Step 1.

### Problem: Backfill fails with "Failed to download original image"
**Cause:** `image_path` in DB is wrong/missing
**Solution:** 
1. Check DB: `SELECT id, sku, image_path FROM products;`
2. Verify files exist in Supabase Storage → `product-images` bucket
3. If missing: Upload images via Admin → Products → Upload

### Problem: Shop still shows placeholders after backfill
**Check:**
1. Browser console for errors
2. DB: `SELECT shop_image_path FROM products;` (should NOT be null)
3. Supabase Storage: Files exist in `derived/<productId>/shop_*.webp`?
4. Hard refresh: Ctrl+Shift+R (clear browser cache)

### Problem: Thumbnails exist but look wrong/cropped badly
**Cause:** Crop state in DB is wrong
**Solution:**
1. Admin → Products → Edit product
2. Adjust crop with editor
3. Save → auto-regenerates thumbnails

---

## 📁 Files Involved

- **Migration:** [supabase/migrations/007_add_thumbnail_paths.sql](supabase/migrations/007_add_thumbnail_paths.sql)
- **Backfill Script:** [scripts/backfill-thumbnails.js](scripts/backfill-thumbnails.js)
- **Shop Renderer:** [pages/shop.js](pages/shop.js) - Shows placeholder if `shop_image_path` missing
- **Thumbnail Generator:** [pages/api/admin/products/generate-thumbnail.js](pages/api/admin/products/generate-thumbnail.js)

---

## 🎯 Success Criteria (Definition of Done)

- ✅ Shop zeigt für alle Produkte Bilder (4:5 format)
- ✅ Admin-Liste zeigt saubere Thumbnails (klar erkennbar)
- ✅ Speichern eines Produkts beeinflusst nur dieses Produkt
- ✅ `shop_image_path` ist für alle Produkte gesetzt (kein Placeholder)
- ✅ Console zeigt KEINE "MISSING shop_image_path" Warnungen
- ✅ Console zeigt KEINE `getBoundingClientRect` Errors

---

## ⏱️ Timeline

1. **Migration 007:** 2 min (copy SQL → paste in Supabase → run)
2. **Backfill Script:** 5 min (downloads + generates + uploads 8 images total)
3. **Verification:** 2 min (check Shop + Admin)
4. **Test Save:** 2 min (edit product → verify isolation)

**Total:** ~10 minutes to full recovery
