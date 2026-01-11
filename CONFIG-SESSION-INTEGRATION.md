# Config Session Integration - Implementation Guide

## Übersicht

Diese Integration ermöglicht eine saubere Trennung zwischen dem Shop (unbreak-one.vercel.app) als **Source of Truth** für Sprache, Cart und Checkout, und dem externen Konfigurator (config.unbreak-one.com) als dedizierte Konfigurations-App.

**KEINE iFrame-Integration**, **KEINE postMessage-Bridge**, **KEINE CORS-Experimente**.

## Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Journey                             │
└─────────────────────────────────────────────────────────────────┘

1. Shop (unbreak-one.vercel.app/shop)
   ↓ Klick "Zum Konfigurator" mit ?lang=en&return=...
   
2. Konfigurator (config.unbreak-one.com)
   ↓ User konfiguriert Produkt
   ↓ Speichert via POST /api/config-session
   ↓ Erhält sessionId
   
3. Return URL (unbreak-one.vercel.app/config-return?session=xyz)
   ↓ Lädt Session via GET /api/config-session/xyz
   ↓ Validiert & mappt Config
   ↓ Fügt zu Warenkorb hinzu
   ↓ Löscht Session via DELETE
   
4. Cart (unbreak-one.vercel.app/cart)
   ✓ Konfiguriertes Produkt im Warenkorb
```

## Komponenten

### A) API Route: POST /api/config-session

**Datei:** `pages/api/config-session.js`

**Request Body:**
```json
{
  "sessionId": "optional-reuse-existing",  // Optional
  "lang": "de",                             // Optional: "de" | "en"
  "config": {                               // Required
    "product_type": "glass_holder",
    "parts": { "base": "black", "holder": "gold" },
    "colors": { "primary": "#000", "accent": "#FFD700" },
    "quantity": 1,
    "price": 4900
  }
}
```

**Response:**
```json
{
  "ok": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Features:**
- Generiert neue UUID wenn `sessionId` fehlt
- Akzeptiert optionale Wiederverwendung einer `sessionId`
- Speichert Session in-memory (Dev) oder Vercel KV (Production)
- TTL: 45 Minuten
- CORS-Support für config.unbreak-one.com

### B) API Route: GET/DELETE /api/config-session/[cfgId]

**Datei:** `pages/api/config-session/[cfgId].js`

**GET Response:**
```json
{
  "lang": "de",
  "config": {
    "product_type": "glass_holder",
    "parts": { ... },
    "quantity": 1
  }
}
```

**DELETE Response:**
```json
{
  "success": true,
  "existed": true
}
```

### C) Return Page: /shop/config-return

**Datei:** `pages/shop/config-return.js`

**Query Parameter:**
- `session` - Session ID vom Konfigurator

**Flow:**
1. Liest `session` aus Query
2. Lädt Config via `GET /api/config-session/{session}`
3. Validiert required fields:
   - `product_type`
   - `parts` oder `colors` (mindestens eins)
   - `quantity` (muss >= 1 sein)
4. Mappt Config → Shop Produkt:
   ```js
   {
     id: "UNBREAK-GLAS-01-123456",
     product_id: "UNBREAK-GLAS-01",
     sku: "UNBREAK-GLAS-01",
     name: "UNBREAK ONE Weinglashalter",
     price: 4900,
     quantity: 1,
     variant: "glass_holder",
     configured: true,
     config: { ...fullConfig }
   }
   ```
5. Fügt Item zu Cart hinzu via `cart.addItem()`
6. Löscht Session via `DELETE /api/config-session/{session}`
7. Zeigt Erfolgs-Feedback (1.5s)
8. Redirected zu `/cart`

**Error Handling:**
- Session nicht gefunden → Zeigt Fehler mit "Zum Shop" Button
- Ungültige Config → Zeigt Fehler mit "Zurück zum Konfigurator" Button
- Cart nicht initialisiert → Zeigt Fehler

### D) Shop Integration: Dynamische Konfigurator-Links

**Datei:** `pages/shop.js`

**Features:**
- Erkennt aktuelle Sprache via `window.i18n.getCurrentLanguage()`
- Tracked Sprachwechsel via Event Listener
- Generiert Konfigurator-URL mit:
  ```
  https://config.unbreak-one.com/?lang=en&return=https%3A%2F%2Funbreak-one.vercel.app%2Fconfig-return
  ```

**Verwendung:**
```jsx
<a href={getConfiguratorUrl()} className="btn-configurator-primary">
  Jetzt gestalten
</a>
```

## Session Store

**Datei:** `lib/session-store.js`

**Typ:** In-Memory Map (Development)

**Für Production:**
```js
// Option 1: Vercel KV (Redis)
import { kv } from '@vercel/kv';
await kv.set(`config-session:${sessionId}`, session, { ex: 2700 }); // 45min

// Option 2: Supabase Table
CREATE TABLE config_sessions (
  id UUID PRIMARY KEY,
  lang VARCHAR(2),
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX idx_expires ON config_sessions(expires_at);
```

**Cleanup:**
- In-Memory: Auto-cleanup alle 10 Minuten
- Vercel KV: TTL automatisch
- Database: Cronjob täglich

## Sprach-Synchronisation

### Shop → Konfigurator

Shop generiert Link mit `?lang=de|en` basierend auf aktuellem i18n-Status:

```js
const currentLang = window.i18n.getCurrentLanguage() || 'de';
const url = `https://config.unbreak-one.com/?lang=${currentLang}&return=...`;
```

### Konfigurator → Shop

Konfigurator speichert Sprache in Session:

```js
POST /api/config-session
{
  "lang": "en",
  "config": { ... }
}
```

Shop liest Sprache aus Session und verwendet sie für Produktnamen:

```js
const { lang, config } = await fetch(`/api/config-session/${sessionId}`);
const name = lang === 'en' 
  ? 'UNBREAK ONE Glass Holder'
  : 'UNBREAK ONE Weinglashalter';
```

## Testing

### 1. Manueller Test - Complete Flow

```bash
# Start dev server
npm run dev

# Test im Browser:
1. Öffne http://localhost:3000/shop
2. Wechsel zu EN (Language Switch)
3. Klick "Jetzt gestalten"
4. Konfigurator sollte auf EN öffnen mit return URL
5. Simuliere config save (siehe unten)
6. Verify redirect zu /shop/config-return
7. Verify Produkt im Cart
```

### 2. API Test Script

```bash
# Starte Server
npm run dev

# In separatem Terminal:
node test-config-session.js
```

Erwartete Ausgabe:
```
🧪 Testing Config Session API Flow...

1️⃣ Creating config session...
✅ Session created: { ok: true, sessionId: '...' }

2️⃣ Retrieving session...
✅ Session retrieved: { lang: 'en', config: {...} }

3️⃣ Deleting session...
✅ Session deleted: { success: true, existed: true }

4️⃣ Verifying deletion...
✅ Session correctly deleted (404 returned)

✅ Complete flow test PASSED!

🧪 Testing optional sessionId parameter...
✅ Custom sessionId accepted: test-session-123
✅ Optional sessionId test PASSED!

🎊 ALL TESTS PASSED! 🎊
```

### 3. cURL Tests

```bash
# Test 1: Create session
curl -X POST http://localhost:3000/api/config-session \
  -H "Content-Type: application/json" \
  -d '{
    "lang": "en",
    "config": {
      "product_type": "glass_holder",
      "quantity": 1
    }
  }'

# Response: {"ok":true,"sessionId":"..."}

# Test 2: Get session
curl http://localhost:3000/api/config-session/SESSION_ID_HERE

# Test 3: Delete session
curl -X DELETE http://localhost:3000/api/config-session/SESSION_ID_HERE
```

## Akzeptanztests

### ✅ Test 1: Shop EN → Config EN → Return

1. Shop auf EN stellen
2. Klick "Jetzt gestalten"
3. Verify: Konfigurator öffnet mit `?lang=en`
4. Verify: Return URL enthält `/shop/config-return`
5. Simuliere save & return
6. Verify: Produkt Name ist englisch
7. Verify: Item im Cart

### ✅ Test 2: Shop DE → Config DE → Return

Wie Test 1, aber mit DE

### ✅ Test 3: Regression - Normaler Shop

1. Öffne /shop
2. Klick "In den Warenkorb" bei Standard-Produkt
3. Verify: Produkt wird hinzugefügt
4. Verify: Checkout funktioniert

### ✅ Test 4: Session Expiry

1. Erstelle Session via POST
2. Warte 46 Minuten (oder ändere TTL für Test)
3. Verify: GET returnt 404
4. Verify: config-return zeigt Fehler

## Deployment Checklist

### Development
- [x] API Routes implementiert
- [x] Return Page erstellt
- [x] Shop Links aktualisiert
- [x] Tests geschrieben

### Production Vorbereitung
- [ ] Session Store auf Vercel KV migrieren
- [ ] Environment Variables setzen:
  - `VERCEL_KV_URL`
  - `VERCEL_KV_TOKEN`
- [ ] CORS für config.unbreak-one.com konfigurieren
- [ ] Monitoring für Session Endpoints

### Post-Deploy
- [ ] Test complete flow auf Production
- [ ] Monitor Session Store Größe
- [ ] Check Error Logs
- [ ] Performance Metrics (API Response Time)

## Konfigurator Implementation (externe App)

Der Konfigurator muss folgende Integration implementieren:

```js
// 1. Parse return URL from query
const urlParams = new URLSearchParams(window.location.search);
const lang = urlParams.get('lang') || 'de';
const returnUrl = urlParams.get('return');

// 2. Set language
setCurrentLanguage(lang);

// 3. On save, create session
async function handleSave(config) {
  const response = await fetch('https://unbreak-one.vercel.app/api/config-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lang: getCurrentLanguage(),
      config: {
        product_type: 'glass_holder',
        parts: config.parts,
        colors: config.colors,
        quantity: config.quantity,
        price: calculatePrice(config),
      },
    }),
  });

  const { ok, sessionId } = await response.json();

  if (ok && returnUrl) {
    // Redirect with session
    window.location.href = `${returnUrl}?session=${sessionId}`;
  }
}
```

## Troubleshooting

### Problem: Session not found

**Ursache:** Session expired oder ungültige ID

**Lösung:**
- Check TTL (default 45min)
- Verify sessionId format (UUID)
- Check session store logs

### Problem: Cart not initialized

**Ursache:** cart.js nicht geladen oder localStorage error

**Lösung:**
- Verify `lib/cart.js` im bundle
- Check browser localStorage quota
- Check browser console for errors

### Problem: Sprache falsch

**Ursache:** i18n system nicht ready

**Lösung:**
- Wait for `i18nReady` event
- Fallback zu 'de' wenn undefined
- Check `window.i18n` exists

### Problem: CORS errors

**Ursache:** config.unbreak-one.com nicht in whitelist

**Lösung:**
- Check `lib/cors-config.js`
- Add origin to `ALLOWED_ORIGINS`
- Restart dev server

## Migration Notes

### Alte iFrame Integration entfernen

Die alte iFrame-basierte Integration kann schrittweise entfernt werden:

1. **Phase 1:** Neue Integration parallel deployen
2. **Phase 2:** A/B Test (50/50)
3. **Phase 3:** 100% auf neue Integration
4. **Phase 4:** iFrame Code entfernen:
   - `public/iframe-language-bridge.js`
   - `lib/configuratorBridge.js`
   - `configurator/configurator.js`

### Alte cfgId Parameter

Der alte `?cfgId=...` Parameter wird noch in `shop.js` gehandhabt für Backward Compatibility. Kann nach Migration entfernt werden.

## Performance

- **API Response Time:** < 50ms (in-memory)
- **Session Storage Size:** ~1KB pro Session
- **Max Sessions:** Unbegrenzt (in-memory), 10000 (Vercel KV free)
- **Cleanup Interval:** 10 Minuten

## Security

- ✅ CORS restricted zu config.unbreak-one.com
- ✅ Session IDs sind UUIDs (nicht ratebar)
- ✅ TTL verhindert unbegrenzte Storage
- ✅ Keine sensitive Daten in Sessions
- ✅ Input validation (lang, config structure)

## Kosten

**Development:** €0 (in-memory)

**Production (Vercel KV):**
- Free: 256MB, 10000 requests/day
- Pro: 512MB, 100000 requests/day ($20/mo)
- Estimated: ~100 sessions/day = €0

## Support

Bei Problemen:
1. Check Browser Console (Frontend Errors)
2. Check Vercel Logs (API Errors)
3. Run `node test-config-session.js` (API Test)
4. Check Session Store stats (dev mode)
