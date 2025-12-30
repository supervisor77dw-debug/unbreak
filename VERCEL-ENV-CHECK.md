# ✅ CRITICAL FIX REQUIRED

## Problem Confirmed:

**Storage bucket 'product-images' EXISTS in Supabase**
**Files ARE being uploaded successfully**
**BUT: SUPABASE_SERVICE_ROLE_KEY is MISSING or INVALID**

Error: `signature verification failed` = Wrong or missing Service Role Key

---

## IMMEDIATE ACTION REQUIRED:

### Step 1: Get Service Role Key from Supabase (30 seconds)

1. Open: https://supabase.com/dashboard
2. Select your project
3. Go to: **Settings** → **API**
4. Find: **Project API keys** section
5. Copy: **`service_role` secret** (NOT the `anon public` key!)
   - It starts with `eyJ...` and is very long
   - Click the 👁️ icon to reveal it
   - **IMPORTANT:** This is the SECRET key, not the public key!

### Step 2: Add to Local .env.local (for testing)

1. Open: `.env.local` in your project root
2. Add this line:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhb...[YOUR_COPIED_KEY]
   ```
3. Save file
4. Restart dev server if running

### Step 3: Add to Vercel Environment Variables (for production)

1. Open: https://vercel.com/supervisor77dw-debug/unbreak/settings/environment-variables
2. Click: **Add New**
3. Fill in:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** [Paste the service_role key from Step 1]
   - **Environments:** ✅ Production ✅ Preview ✅ Development (all 3!)
4. Click: **Save**
5. **IMPORTANT:** Go to Deployments tab
6. Find latest deployment → Click ⋯ menu → **Redeploy**

---

## Verification:

### After adding to .env.local:
```powershell
node scripts/verify-storage-setup.js
```

**Expected output:**
```
✅ Bucket 'product-images' exists
✅ Found X files in products/ folder
✅ Found X products with images
✅ Public URL generation works
✅ Storage setup verification PASSED
```

**If you see:**
```
❌ Error listing buckets: signature verification failed
```
= Service Role Key is wrong or missing!

### After Vercel redeploy (~2 min):

1. Hard-refresh browser: `Ctrl + Shift + R`
2. Open browser console (F12)
3. Go to /backend/products
4. Create new product with image
5. Check console logs:

```
🔑 Using SERVICE_ROLE_KEY for upload
✅ Upload successful:
  - File path: products/product-1767123456.jpg
  - Public URL: https://...supabase.co/storage/v1/object/public/product-images/products/...
  - File verified in bucket: true
✅ Image loaded: https://...
```

---

## Why This Matters:

**ANON_KEY (public):**
- ❌ Cannot bypass Row Level Security (RLS)
- ❌ Upload fails silently with RLS policies
- ❌ Returns fake URLs that don't exist

**SERVICE_ROLE_KEY (secret):**
- ✅ Bypasses all RLS policies
- ✅ Full admin access to storage
- ✅ Upload works reliably
- ⚠️ MUST be kept secret (never commit to git!)

---

## Security Note:

✅ `.env.local` is in `.gitignore` - safe to store secrets there
✅ Vercel Environment Variables are encrypted - safe
❌ NEVER commit SERVICE_ROLE_KEY to git
❌ NEVER expose in client-side code

---

## Still Having Issues?

Run diagnostic:
```powershell
node scripts/verify-storage-setup.js
```

Check Vercel logs:
1. https://vercel.com/supervisor77dw-debug/unbreak/deployments
2. Click latest deployment
3. Click "Functions" tab
4. Find `/api/products/upload`
5. Check logs for errors

---
