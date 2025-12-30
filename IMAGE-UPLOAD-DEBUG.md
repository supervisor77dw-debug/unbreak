# Image Upload Debugging Guide

## Problem
Produktbilder werden hochgeladen, aber im Backend nur als Placeholder angezeigt.

## Root Causes Identified

### 1. ✅ Missing Next.js Image Domain Configuration
**Problem:** Next.js blockiert externe Bild-URLs standardmäßig
**Fix:** `next.config.js` erweitert mit:
```javascript
images: {
  domains: ['qnzsdytdghfukrqpscsg.supabase.co'],
  remotePatterns: [{
    protocol: 'https',
    hostname: '*.supabase.co',
    pathname: '/storage/v1/object/public/**',
  }],
}
```

### 2. ⚠️ Storage Bucket Setup Required
**Problem:** Supabase Storage Bucket existiert möglicherweise nicht
**Fix:** SQL-Script ausführen: [database/storage-setup.sql](database/storage-setup.sql)

### 3. ⚠️ Database Column Missing
**Problem:** `image_url` Spalte fehlt möglicherweise in `products` Tabelle
**Fix:** SQL-Script ausführen: [database/add-image-url-column.sql](database/add-image-url-column.sql)

## Diagnostic Tools Added

### Console Logging
Kompletter Upload-Flow wird jetzt geloggt:

1. **API Upload** (`/api/products/upload`)
   ```
   ✅ Upload successful:
     - File path: products/product-1735567890123.jpg
     - Public URL: https://...supabase.co/storage/v1/object/public/product-images/products/product-1735567890123.jpg
     - Bucket: product-images
   ```

2. **ProductForm**
   ```
   ✅ Image uploaded, URL: https://...
   ```

3. **Backend Products Page**
   ```
   💾 Saving product to DB: { name, sku, image_url, ... }
   ```

4. **ProductList Rendering**
   ```
   ✅ Image loaded: https://...
   ❌ Image load failed: https://... (if error)
   ```

### SQL Diagnostics
Run [database/diagnose-image-storage.sql](database/diagnose-image-storage.sql) in Supabase Dashboard:
- Checks if `image_url` column exists
- Lists products with images
- Verifies storage bucket exists
- Shows storage policies
- Counts products with/without images

## Testing Workflow

### 1. Setup (In Supabase Dashboard SQL Editor)

```sql
-- Run these in order:

-- Step 1: Add image_url column
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Step 2: Create storage bucket & policies
-- (Copy complete content from database/storage-setup.sql)
```

### 2. Test Product Creation (On Production Site)

1. **Deploy aktualisieren:**
   - Warte ~2 Minuten bis Vercel Deployment fertig ist
   - Hard-Refresh: `Strg + Shift + R`

2. **Login:**
   - Gehe zu `/login.html`
   - Login als Admin

3. **Produkt erstellen:**
   - Backend → Produkte → "Neues Produkt"
   - Alle Felder ausfüllen
   - Bild hochladen (max 5MB, JPEG/PNG/WebP)
   - Speichern

4. **Console Logs prüfen (F12):**
   ```
   ✅ Image uploaded, URL: https://qnzsdytdghfukrqpscsg.supabase.co/...
   💾 Saving product to DB: {...}
   ✅ Image loaded: https://...
   ```

5. **Visuell prüfen:**
   - Produktliste zeigt Thumbnail (120x120px)
   - Kein Placeholder "Kein Bild"
   - Bild lädt korrekt

### 3. Verify in Database

Run in Supabase SQL Editor:
```sql
SELECT id, name, sku, image_url 
FROM products 
WHERE image_url IS NOT NULL
ORDER BY created_at DESC 
LIMIT 5;
```

Expected output:
```
| id | name | sku | image_url |
|----|------|-----|-----------|
| 123 | Test Product | UBO-001 | https://qnzsdytdghfukrqpscsg.supabase.co/storage/v1/object/public/product-images/products/product-1735567890123.jpg |
```

### 4. Direct URL Test

Copy `image_url` from DB and open in browser:
- ✅ Should show image directly
- ❌ If 404 → Storage bucket nicht erstellt oder Policies fehlen
- ❌ If 403 → Permissions problem

## Common Issues & Solutions

### Image shows placeholder
**Cause:** Next.js domain not configured
**Solution:** Already fixed in commit a71560d - wait for Vercel deployment

### Upload fails with "Bucket not found"
**Cause:** Storage bucket doesn't exist
**Solution:** Run [database/storage-setup.sql](database/storage-setup.sql)

### DB error "column 'image_url' does not exist"
**Cause:** Column not added to products table
**Solution:** Run [database/add-image-url-column.sql](database/add-image-url-column.sql)

### Image URL in DB but 404 when accessed
**Cause:** File wasn't uploaded to Supabase Storage
**Solution:** Check API logs, verify SUPABASE_SERVICE_ROLE_KEY is set in Vercel env vars

### Status constraint violation
**Cause:** Using 'pending' instead of 'pending_review'
**Solution:** Already fixed in commit db9a2bc

## Architecture Overview

```
┌─────────────────┐
│  ProductForm    │
│  (Component)    │
└────────┬────────┘
         │ 1. User selects image
         │ 2. handleSubmit() triggers
         │ 3. uploadImage() called
         ▼
┌─────────────────────────┐
│  /api/products/upload   │
│  (API Route)            │
├─────────────────────────┤
│ 1. Parse FormData       │
│ 2. Save to /tmp         │
│ 3. Upload to Supabase   │
│ 4. Return public URL    │
└────────┬────────────────┘
         │ Returns: { imageUrl: "https://..." }
         ▼
┌─────────────────────┐
│  ProductForm        │
│  handleSubmit()     │
├─────────────────────┤
│ productData = {     │
│   name,             │
│   sku,              │
│   image_url: url,   │
│   ...               │
│ }                   │
└────────┬────────────┘
         │ Calls onSave(productData)
         ▼
┌─────────────────────┐
│  products/index.js  │
│  handleSave()       │
├─────────────────────┤
│ supabase            │
│   .from('products') │
│   .insert([data])   │
└────────┬────────────┘
         │ Saves to DB
         ▼
┌─────────────────────┐
│  Database           │
│  products table     │
├─────────────────────┤
│ id | name | sku |  │
│ image_url         │
│ "https://..."     │
└────────┬────────────┘
         │ Fetched by loadProducts()
         ▼
┌─────────────────────┐
│  ProductList        │
│  (Component)        │
├─────────────────────┤
│ <img                │
│   src={image_url}   │
│   onLoad={log}      │
│   onError={log}     │
│ />                  │
└─────────────────────┘
```

## Files Changed (Commit a71560d)

1. **next.config.js** - Added Supabase Storage domain config
2. **pages/api/products/upload.js** - Added upload success logging
3. **components/backend/ProductForm.jsx** - Added image upload logging
4. **pages/backend/products/index.js** - Added DB save logging
5. **components/backend/ProductList.jsx** - Added image load/error logging + placeholder
6. **database/diagnose-image-storage.sql** - New diagnostic SQL queries

## Next Steps

1. ⏳ **Warte auf Vercel Deployment** (~2 Minuten)
2. 🗄️ **Führe SQL Scripts aus** (Supabase Dashboard):
   - [database/add-image-url-column.sql](database/add-image-url-column.sql)
   - [database/storage-setup.sql](database/storage-setup.sql)
3. 🔄 **Hard-Refresh Browser** (Strg + Shift + R)
4. 🧪 **Test Product Creation** mit Bild-Upload
5. 👀 **Prüfe Console Logs** für Debug-Output
6. ✅ **Verifiziere Bild** wird korrekt angezeigt

## Success Criteria

- ✅ Upload-API gibt public URL zurück (Console: "✅ Upload successful")
- ✅ URL wird in DB gespeichert (SQL SELECT zeigt image_url)
- ✅ Bild lädt im Frontend (Console: "✅ Image loaded")
- ✅ Thumbnail 120x120px sichtbar in Produktliste
- ✅ Kein "Kein Bild" Placeholder bei Produkten mit Bildern
- ✅ Direkter Browser-Aufruf der image_url zeigt Bild (HTTP 200)
