# Config Session Redirect Flow - Implementation Guide

## 🎯 Overview

**NEW ARCHITECTURE**: Standalone Konfigurator mit Redirect-Flow (NO iframe, NO postMessage)

```
User Flow:
1. Click "Konfigurator" → Redirect zu config.<domain>/?lang=de&return=<shop-url>
2. User konfiguriert → Konfigurator sendet config zu POST /api/config-session
3. Konfigurator redirected zu return URL mit ?cfgId=<uuid>
4. Shop lädt session, fügt zu cart hinzu, entfernt cfgId aus URL
```

---

## 📁 Implementierte Files

### API Routes

#### **`/pages/api/config-session.js`** - POST endpoint
- **Purpose**: Store configurator session
- **Request**: `{ lang, variantKey, product_sku, config, meta }`
- **Response**: `{ cfgId }`
- **Storage**: In-memory Map (PRODUCTION: Use Vercel KV/Redis)
- **TTL**: 2 hours

#### **`/pages/api/config-session/[cfgId].js`** - GET/DELETE endpoint
- **GET**: Retrieve session by cfgId
- **DELETE**: Cleanup after add-to-cart
- **Response**: Full session object or 404

### Frontend

#### **`/pages/shop.js`** - Modified
- **NEW useEffect**: Detects `?cfgId=` parameter on page load
- **handleConfigSessionRedirect()**: 
  1. Fetch session from API
  2. Validate data
  3. Add to cart using existing shop logic
  4. Remove cfgId from URL via `history.replaceState()`
  5. Show success notification (non-blocking)
  6. Delete session (cleanup)

#### **`/components/Header.jsx`** - Modified
- **NEW handleConfiguratorClick()**: 
  - Reads current lang from `window.i18n`
  - Constructs redirect URL: `config.<domain>/?lang=X&return=Y`
  - Redirects via `window.location.href`
- **Updated Menu**: Konfigurator link uses `onClick={handleConfiguratorClick}`

---

## 🔧 Configuration

### Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_CONFIGURATOR_DOMAIN=https://unbreak-3-d-konfigurator.vercel.app
```

### Storage (PRODUCTION)

Current implementation uses **in-memory Map** (lost on server restart).

**For PRODUCTION**, replace with persistent storage:

#### Option 1: Vercel KV (Recommended)
```bash
npm install @vercel/kv
```

```javascript
// pages/api/config-session.js
import { kv } from '@vercel/kv';

// Store
await kv.set(`cfg:${cfgId}`, session, { ex: 7200 }); // 2h TTL

// Retrieve
const session = await kv.get(`cfg:${cfgId}`);

// Delete
await kv.del(`cfg:${cfgId}`);
```

#### Option 2: Upstash Redis
```bash
npm install @upstash/redis
```

```javascript
import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});
```

#### Option 3: Database (Supabase)
Create table:
```sql
CREATE TABLE config_sessions (
  cfg_id UUID PRIMARY KEY,
  session_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expires ON config_sessions(expires_at);
```

---

## 🧪 Testing

### 1. Test API Endpoints

**Create Session:**
```bash
curl -X POST http://localhost:3000/api/config-session \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "de",
    "variantKey": "glass_holder",
    "product_sku": "UNBREAK-GLAS-01",
    "config": {
      "colors": {"base": "mint", "arm": "darkBlue"},
      "finish": "matte",
      "quantity": 1
    }
  }'
```

**Response:**
```json
{ "cfgId": "123e4567-e89b-12d3-a456-426614174000" }
```

**Retrieve Session:**
```bash
curl http://localhost:3000/api/config-session/123e4567-e89b-12d3-a456-426614174000
```

**Delete Session:**
```bash
curl -X DELETE http://localhost:3000/api/config-session/123e4567-e89b-12d3-a456-426614174000
```

### 2. Test Redirect Flow

1. Click "Konfigurator" in menu
2. Check console: `[MENU] Redirecting to configurator: https://...`
3. Land on config app with `?lang=de&return=https://...`
4. (Simulate) Return to `/shop?cfgId=XYZ`
5. Check console:
   - `[SHOP] cfgId detected: XYZ`
   - `[SHOP] session loaded: {variantKey, sku}`
   - `[SHOP] add-to-cart done`
6. Verify: URL is `/shop` (cfgId removed)
7. Verify: Item in cart

---

## 📊 Logging

### Console Outputs

**Menu Click:**
```
[MENU] Redirecting to configurator: https://config.../lang=de&return=https://...
```

**Shop cfgId Handling:**
```
[SHOP] cfgId detected: 123e4567-...
[SHOP] session loaded: {variantKey: "glass_holder", sku: "UNBREAK-GLAS-01"}
[SHOP] add-to-cart done
```

**API:**
```
[CONFIG_SESSION] Created session: {cfgId, lang, variantKey, product_sku, ttl: '2h'}
[CONFIG_SESSION] Retrieved session: 123e4567-...
[CONFIG_SESSION] Deleted session: 123e4567-... (existed)
```

---

## ✅ Acceptance Criteria

- [x] Menu "Konfigurator" redirects to `config.<domain>/?lang=X&return=Y`
- [x] API POST `/api/config-session` creates session with cfgId
- [x] API GET `/api/config-session/:cfgId` retrieves session
- [x] Shop detects `?cfgId=` parameter and loads session
- [x] Shop adds configured product to cart
- [x] Shop removes cfgId from URL after processing
- [x] User sees success notification (non-blocking)
- [x] No iframe, no postMessage, no bridge errors
- [x] Language consistency (shop is source of truth)

---

## 🚀 Deployment

### 1. Install Dependencies
```bash
npm install uuid
```

### 2. Set Environment Variable
Add to Vercel project settings:
```
NEXT_PUBLIC_CONFIGURATOR_DOMAIN=https://unbreak-3-d-konfigurator.vercel.app
```

### 3. Deploy
```bash
git add .
git commit -m "feat: Config session redirect flow - no iframe"
git push origin master
```

### 4. Verify Deployment
- Check Vercel logs for API route execution
- Test menu redirect
- Test return flow with mock cfgId

---

## 🔄 Migration from Old System

### What to Remove (Optional - after verification)

1. **iframe integration**:
   - `/public/configurator.html` (if not needed)
   - `/public/iframe-language-bridge-v2.js`
   - `/public/lib/bridge-*.js`

2. **postMessage listeners**:
   - Remove all `window.addEventListener('message', ...)` in shop pages

3. **Environment variables**:
   - No longer needed: iframe origins, postMessage config

### What to Keep

- i18n system (used for language detection)
- Cart system (used for add-to-cart)
- Checkout flow (unchanged)

---

## 🐛 Troubleshooting

### Issue: "Session not found"
- Check TTL (2h default)
- Verify API storage (in-memory resets on server restart)
- Migrate to persistent storage (Vercel KV)

### Issue: "Cart not initialized"
- Check browser console for cart errors
- Verify `/lib/cart.js` is loaded

### Issue: "Redirect loop"
- Check return URL encoding
- Verify configurator doesn't auto-redirect back

### Issue: "Language mismatch"
- Check `window.i18n.getCurrentLanguage()`
- Verify lang parameter in redirect URL

---

## 📚 Next Steps

1. **Deploy to staging** - Test full flow
2. **Migrate storage** - From in-memory to Vercel KV
3. **Update configurator** - Implement session API calls + return redirect
4. **Remove old iframe system** - After verification
5. **Production testing** - End-to-end user flow

---

**Status**: ✅ Implementation Complete  
**Last Updated**: 2026-01-11  
**Version**: 1.0.0
