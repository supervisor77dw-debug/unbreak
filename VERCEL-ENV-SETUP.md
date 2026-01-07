# ⚠️ WICHTIG: Vercel Environment Variables

Nach dem Deploy, diese ENV vars in Vercel Dashboard setzen:

## Settings → Environment Variables → Add

### 1. ADMIN_API_KEY (Server-side)
**Name:** `ADMIN_API_KEY`  
**Value:** `K0ZUzL5rWPxK7nmdudjVJ9mG9k9EHMXRcKUBkiAYCjw=`  
**Environments:** Production, Preview, Development  
**Type:** Secret

### 2. NEXT_PUBLIC_ADMIN_API_KEY (Client-side)
**Name:** `NEXT_PUBLIC_ADMIN_API_KEY`  
**Value:** `K0ZUzL5rWPxK7nmdudjVJ9mG9k9EHMXRcKUBkiAYCjw=`  
**Environments:** Production, Preview, Development  
**Type:** Plain Text

## Nach dem Setzen:
1. Redeploy triggern (oder warten auf nächsten Push)
2. Test: https://unbreak-one.vercel.app/admin/customers
3. Expected: Network Tab → `/api/admin/customers` → 200 OK

## Hinweis:
- NEXT_PUBLIC_* wird im Client-Bundle eingebettet
- Nur für Admin-UI verwenden (nicht öffentlich linken)
- Später: Migration auf Supabase RLS + JWT Auth
