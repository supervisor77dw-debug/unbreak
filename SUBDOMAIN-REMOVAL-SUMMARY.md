# 🔧 Subdomain Removal – Migration Summary

**Datum:** 27. Dezember 2025  
**Problem:** SSL-Fehler durch nicht konfigurierte Subdomains  
**Lösung:** Main-Domain Path-Routing

---

## ❌ Problem

**SSL-Fehler:**
```
NET::ERR_CERT_COMMON_NAME_INVALID
```

**Ursache:**
- Code referenzierte Subdomains: `shop.unbreak-one.com`, `op.unbreak-one.com`
- Diese Subdomains sind **NICHT konfiguriert** (kein DNS, kein SSL-Zertifikat)
- Nur `unbreak-one.com` ist aktiv

---

## ✅ Lösung

**Main-Domain Path-Routing:**

Alle internen Routen bleiben auf der Hauptdomain:
- ✅ `unbreak-one.com/shop.html`
- ✅ `unbreak-one.com/login`
- ✅ `unbreak-one.com/account`
- ✅ `unbreak-one.com/ops`
- ✅ `unbreak-one.com/admin`

**KEINE Subdomains mehr:**
- ❌ `shop.unbreak-one.com` → ENTFERNT
- ❌ `op.unbreak-one.com` → ENTFERNT

---

## 📝 Durchgeführte Änderungen

### 1. HTML Navigation (4 Dateien)

**Vorher:**
```html
<a href="https://shop.unbreak-one.com" target="_blank">Jetzt kaufen</a>
<a href="https://shop.unbreak-one.com/basic-set" target="_blank">In den Warenkorb</a>
```

**Nachher:**
```html
<a href="/shop.html">Jetzt kaufen</a>
<a href="/shop.html#basic-set">In den Warenkorb</a>
```

**Geänderte Dateien:**
- `index.html` (4 Links)
- `components/header.js` (1 Nav-Link)
- `public/index.html` (4 Links)
- `public/components/header.js` (1 Nav-Link)

**Entfernt:**
- `target="_blank"` (Navigation bleibt auf gleicher Domain)

---

### 2. Dokumentation (2 Dateien)

**`.env.example`**

**Vorher:**
```bash
# Production
# NEXT_PUBLIC_BASE_URL=https://unbreak-one.com
```

**Nachher:**
```bash
# Production (main domain only - no shop.unbreak-one.com or op.unbreak-one.com)
# NEXT_PUBLIC_BASE_URL=https://unbreak-one.com
```

**`SETUP-ECOMMERCE.md`**

**Vorher:**
```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # oder https://unbreak-one.com
```

**Nachher:**
```bash
# App (main domain only - no subdomains)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # oder https://unbreak-one.com (Production)
```

---

### 3. Stripe Integration (Bereits korrekt)

**Checkout APIs nutzen `NEXT_PUBLIC_BASE_URL`:**

```javascript
// pages/api/checkout/bundle.js
success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`
cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel.html`

// pages/api/checkout/preset.js
success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`
cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel.html`

// pages/api/checkout/create.js
success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderNumber}`
cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/configurator?canceled=true`
```

**Konfiguration:**
- Development: `http://localhost:3000`
- Production: `https://unbreak-one.com` (in `.env.local` setzen)

**Stripe Webhook:**
- URL: `https://unbreak-one.com/api/stripe/webhook`
- Keine Subdomain-Routing nötig

---

## 🧪 Verifikation

**PowerShell-Tests durchgeführt:**

```powershell
# Test 1: shop.unbreak-one.com Suche
(Get-ChildItem -Recurse -Include *.html,*.js,*.md -File | 
  Select-String -Pattern "shop\.unbreak-one\.com").Count
# Ergebnis: 0 ✅

# Test 2: op.unbreak-one.com Suche
(Get-ChildItem -Recurse -Include *.html,*.js,*.md -File | 
  Select-String -Pattern "op\.unbreak-one\.com").Count
# Ergebnis: 0 ✅
```

**Ergebnis:**
- ✅ Null Matches für `shop.unbreak-one.com`
- ✅ Null Matches für `op.unbreak-one.com`
- ✅ Alle Subdomain-Referenzen entfernt

---

## 📊 Geänderte Dateien

| Datei | Typ | Änderungen |
|-------|-----|-----------|
| `index.html` | HTML | 4 Links (shop → /shop.html) |
| `components/header.js` | JS | 1 Nav-Link |
| `public/index.html` | HTML | 4 Links (shop → /shop.html) |
| `public/components/header.js` | JS | 1 Nav-Link |
| `.env.example` | Config | Kommentar (main domain only) |
| `SETUP-ECOMMERCE.md` | Docs | Klarstellung (no subdomains) |

**Total:** 6 Dateien geändert, 10 Subdomain-Links entfernt

---

## 🚀 Production Setup

### Environment Variable setzen

**`.env.local` (Production):**
```bash
NEXT_PUBLIC_BASE_URL=https://unbreak-one.com
```

**WICHTIG:**
- Kein Trailing Slash: ~~`https://unbreak-one.com/`~~
- Nur Hauptdomain: ~~`https://shop.unbreak-one.com`~~

### Stripe Dashboard Update

**Redirect URLs prüfen:**

```
Erfolg: https://unbreak-one.com/success.html
Abbruch: https://unbreak-one.com/cancel.html
```

**Webhook Endpoint:**
```
URL: https://unbreak-one.com/api/stripe/webhook
Events: checkout.session.completed, payment_intent.succeeded
```

---

## ✅ Checkliste Production-Deployment

### Vor dem Deployment

- [ ] `.env.local` erstellt
- [ ] `NEXT_PUBLIC_BASE_URL=https://unbreak-one.com` gesetzt
- [ ] Keine Subdomains in Code (verifiziert ✅)
- [ ] Stripe Webhook URL aktualisiert

### Nach dem Deployment

- [ ] `/shop.html` lädt ohne SSL-Fehler
- [ ] Navigation `/shop → /login → /account` funktioniert
- [ ] Checkout-Flow (Stripe Redirect) funktioniert
- [ ] Success/Cancel URLs zeigen richtige Seiten
- [ ] Browser Console: Keine SSL/CORS-Fehler

### Optional (wenn später Subdomains gewünscht)

**Falls du später Subdomains einrichten möchtest:**

1. **DNS konfigurieren:**
   ```
   shop.unbreak-one.com → CNAME unbreak-one.com
   ops.unbreak-one.com  → CNAME unbreak-one.com
   ```

2. **SSL-Zertifikat erweitern:**
   - Wildcard-Zertifikat: `*.unbreak-one.com`
   - Oder einzeln: `shop.unbreak-one.com`, `ops.unbreak-one.com`

3. **Code anpassen:**
   - Navigation Links zurück zu Subdomains (optional)
   - `NEXT_PUBLIC_BASE_URL` bleibt auf Hauptdomain
   - Stripe URLs passen sich automatisch an

**Hinweis:** Subdomains sind OPTIONAL. Path-Routing (`/shop`, `/ops`) ist vollständig funktional und einfacher zu warten.

---

## 🔍 Troubleshooting

### Problem: SSL-Fehler bleiben

**Lösung:**
1. Browser-Cache leeren (Ctrl+Shift+Del)
2. Hard Reload (Ctrl+Shift+R)
3. Incognito-Fenster testen
4. `NEXT_PUBLIC_BASE_URL` in `.env.local` prüfen

### Problem: Links führen zu 404

**Checkliste:**
- [ ] Dateien in `/public` vorhanden?
  - `shop.html`, `login.html`, `account.html`, `ops.html`, `admin.html`
- [ ] Server läuft auf Port 3000?
- [ ] `/api` Routes deployed (Vercel/Next.js)?

### Problem: Stripe Redirect fehlerhaft

**Checkliste:**
- [ ] `NEXT_PUBLIC_BASE_URL` korrekt gesetzt?
- [ ] Stripe Dashboard: Redirect URLs aktualisiert?
- [ ] Webhook Secret korrekt in `.env.local`?

---

## 📚 Weitere Dokumentation

| Dokument | Zweck |
|----------|-------|
| [CHECKOUT-INTEGRATION.md](CHECKOUT-INTEGRATION.md) | Checkout-System API Spec |
| [AUTH-STATUS.md](AUTH-STATUS.md) | Auth-System Status & Setup |
| [SETUP-ECOMMERCE.md](SETUP-ECOMMERCE.md) | E-Commerce Setup Guide |
| [OPS-GUIDE.md](OPS-GUIDE.md) | Staff Operations Handbuch |

---

**Status:** ✅ Abgeschlossen  
**Commit:** `7ec0bc4`  
**Branch:** `master`
