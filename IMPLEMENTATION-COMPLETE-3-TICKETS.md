# GESAMT-PROMPT: 3 Tickets – Implementierung abgeschlossen ✅

**Datum:** 2026-01-08
**Branch:** master
**Commits:** 3 (1 pro Ticket)

---

## 📝 ÜBERSICHT

Alle 3 Tickets wurden vollständig implementiert:

### ✅ TICKET 1: iFrame Locale-Bridge (src param + postMessage)
**Commit:** `198f479` - "TICKET 1: iFrame Locale-Bridge (src param + postMessage)"

**Implementierung:**
- **public/iframe-language-bridge.js** (NEU):
  - Sendet `postMessage` mit `{type: 'SET_LOCALE', locale: 'de'|'en'}` an 3D-Konfigurator
  - Updated iframe.src mit `?lang=de|en` Query-Parameter
  - Lauscht auf `i18nLanguageChanged` + `languageChanged` Events
  - Multiple timing attempts (on load, 100ms, 500ms) für Robustheit
  - Target: `iframe#configurator-iframe` bei `https://unbreak-3-d-konfigurator.vercel.app`

- **i18n.js + public/i18n.js** (MODIFIZIERT):
  - Feuert zusätzliches `i18nLanguageChanged` Event in `setLanguage()`
  - Backward compatible: Bestehendes `languageChanged` Event bleibt

- **public/configurator.html** (MODIFIZIERT):
  - Lädt `iframe-language-bridge.js` via `<script defer>`

**Funktionsweise:**
1. Nutzer klickt DE/EN Toggle auf Homepage
2. `window.i18n.setLanguage('de')` wird aufgerufen
3. Dual events gefeuert: `languageChanged` + `i18nLanguageChanged`
4. iframe-language-bridge.js empfängt Event
5. Sendet postMessage an iframe: `{type: 'SET_LOCALE', locale: 'de'}`
6. Updated iframe.src: `https://.../?lang=de`

**KEINE Änderungen an:**
- Bestehender Language Toggle (wie gefordert)
- NextAuth/Middleware/Session (Constraint eingehalten)

---

### ✅ TICKET 2: Region-Ermittlung DE/EU/INT + shipping_region
**Commit:** `76b0d3d` - "TICKET 2: Region-Ermittlung DE/EU/INT + shipping_region Feld"

**Implementierung:**
- **lib/utils/shipping.js** (NEU):
  - `countryToRegion(countryCode)`: Erkennt 'DE' | 'EU' | 'INT'
  - EU_COUNTRIES: 27 EU-Länder (AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE)
  - `getDefaultShippingForRegion()`: DE: 4,90€ / EU: 12,90€ / INT: 24,90€
  - `getRegionLabel()`: DE/EN Labels

- **prisma/schema.prisma** (MODIFIZIERT):
  - `shippingRegion String? @map("shipping_region")` zu Order Model hinzugefügt

- **prisma/migrations/.../migration.sql** (NEU):
  - `ALTER TABLE admin_orders ADD COLUMN shipping_region VARCHAR(10);`
  - Index: `CREATE INDEX idx_orders_shipping_region ON admin_orders(shipping_region);`

- **pages/api/webhooks/stripe.js** (MODIFIZIERT):
  - Import: `import { countryToRegion } from '../../../lib/utils/shipping.js'`
  - Erkennt Region aus `session.shipping_details.address.country`
  - Speichert `shippingRegion` beim Order Create + Update
  - Logging: `"🌍 Shipping country: DE → Region: DE"`

**Bereits vorhanden (aus vorheriger Session):**
- `shipping_rates` Tabelle mit country_code, label_de/en, price_net
- Admin UI unter `/admin/shipping` (CRUD für Versandkosten)
- MwSt 19% Berechnung in Webhook (`subtotalNet`, `taxRate`, `taxAmount`, `totalGross`)
- Order Detail View zeigt MwSt korrekt an

---

### ✅ TICKET 3: Order UI Cleanup - Produktnamen + Begriffe konsistent
**Commit:** `f37d0f4` - "TICKET 3: Order UI Cleanup - Produktnamen + Begriffe konsistent"

**Implementierung:**
- **pages/admin/orders/[id].js** (MODIFIZIERT):
  - Produktname: Zeigt "Glashalter (konfiguriert)" / "Flaschenhalter (konfiguriert)" basierend auf `config.variant`
  - Shipping Region Display: `"Versand (Netto) [DE/EU/INT]"` in Summen-Anzeige
  - Unterscheidung: Configured products vs. standard products

- **public/translations/de.json + en.json** (MODIFIZIERT):
  - **configurator.parts** (System Keys: `base`, `arm`, `module`, `pattern`, `finish`):
    - DE: Grundplatte, Arm, Gummilippe, Muster, Oberfläche
    - EN: Base plate, Arm, Rubber lip, Pattern, Finish
  - **configurator.colors** (7 Farben: `mint`, `green`, `purple`, `ice_blue`, `dark_blue`, `red`, `black`):
    - DE: Mint, Grün, Lila, Eisblau, Dunkelblau, Rot, Schwarz
    - EN: Mint, Green, Purple, Ice Blue, Dark Blue, Red, Black
  - **configurator.products**:
    - `glass_holder`: "Glashalter (konfiguriert)" / "Glass Holder (configured)"
    - `bottle_holder`: "Flaschenhalter (konfiguriert)" / "Bottle Holder (configured)"

**Bereits gefixt (aus vorheriger Session):**
- 66,40€ Bug: Webhook recalculates totals from items (`subtotalNet`, `taxAmount`, `totalGross`)
- Summen-Anzeige: Zeigt Netto/MwSt (19%)/Versand/Brutto korrekt
- AdminLayout: Deutsche Labels in Sidebar

---

## 🔑 TECHNISCHE DETAILS

### System Keys (Konfigurator)
- **Parts:** `base`, `arm`, `module`, `pattern`, `finish` (NICHT ändern!)
- **Colors:** `mint`, `green`, `purple`, `ice_blue`, `dark_blue`, `red`, `black` (7 Farben)
- **Product Types:** `glass_holder`, `bottle_holder`

### Regionen & Versandkosten
| Region | Länder | Standard-Versand (Netto) |
|--------|--------|--------------------------|
| **DE** | Deutschland | 4,90 EUR (490 cents) |
| **EU** | 27 EU-Länder | 12,90 EUR (1290 cents) |
| **INT** | Rest der Welt | 24,90 EUR (2490 cents) |

### MwSt-Berechnung (19%)
```
Zwischensumme (Netto):  Items.reduce(unitPrice × qty)
Versand (Netto):        amountShipping (from shipping_rates)
MwSt (19%):             (Netto + Versand) × 0.19
Gesamt (Brutto):        Netto + MwSt + Versand
```

---

## 🚀 DEPLOYMENT

### Vor dem Deployment:
1. **Prisma Migration ausführen:**
   ```bash
   npx prisma migrate deploy
   # Alternativ in Supabase SQL Editor:
   # ALTER TABLE admin_orders ADD COLUMN shipping_region VARCHAR(10);
   # CREATE INDEX idx_orders_shipping_region ON admin_orders(shipping_region);
   ```

2. **Prisma Client regenerieren:**
   ```bash
   npx prisma generate
   ```

### Nach dem Deployment:
- **3D-Konfigurator testen:**
  1. Zu `/configurator` navigieren
  2. DE/EN Toggle klicken
  3. Browser DevTools öffnen → Console
  4. Prüfen ob postMessage gesendet wird: `{type: 'SET_LOCALE', locale: 'de'}`
  5. Prüfen ob iframe.src `?lang=de` Parameter hat

- **Test-Bestellungen erstellen:**
  1. **DE-Bestellung:** Kunde mit deutscher Adresse → Region sollte "DE" sein
  2. **EU-Bestellung:** Kunde aus Frankreich/Österreich → Region sollte "EU" sein
  3. In `/admin/orders/[id]` prüfen:
     - Versandkosten zeigen `[DE]` oder `[EU]` neben "Versand (Netto)"
     - MwSt 19% korrekt berechnet
     - Produktname: "Glashalter (konfiguriert)" (wenn configured)

---

## 📊 ACCEPTANCE TESTS

### Test 1: iFrame Sprach-Kommunikation
- [ ] Homepage öffnen, zu Konfigurator navigieren
- [ ] DE/EN Toggle klicken
- [ ] Browser DevTools → Console öffnen
- [ ] Prüfen: `🌐 [iFrame Bridge] Sending language to iframe: de`
- [ ] Prüfen: `postMessage` mit `{type: 'SET_LOCALE', locale: 'de'}` gesendet
- [ ] Prüfen: iframe.src enthält `?lang=de`
- [ ] Prüfen: 3D-Konfigurator Labels ändern sich (falls bereits implementiert)

### Test 2: Versandkosten-Regionen
- [ ] Test-Bestellung: DE-Adresse (Berlin)
  - Erwartet: `shipping_region = 'DE'`, Versand = 490 cents (4,90 EUR)
- [ ] Test-Bestellung: EU-Adresse (Paris, FR)
  - Erwartet: `shipping_region = 'EU'`, Versand = 1290 cents (12,90 EUR)
- [ ] Test-Bestellung: INT-Adresse (New York, US)
  - Erwartet: `shipping_region = 'INT'`, Versand = 2490 cents (24,90 EUR)
- [ ] `/admin/orders/[id]` zeigt `[DE/EU/INT]` neben Versand an

### Test 3: MwSt-Berechnung
- [ ] Order Detail View öffnen
- [ ] Prüfen: Zwischensumme (Netto) = Summe aller Items (unitPrice × qty)
- [ ] Prüfen: MwSt (19%) = (Netto + Versand) × 0.19
- [ ] Prüfen: Gesamt (Brutto) = Netto + MwSt + Versand
- [ ] Keine 66,40€ vs 53,90€ Mismatch-Warnung mehr

### Test 4: Produktnamen
- [ ] Configured product: Zeigt "Glashalter (konfiguriert)" oder "Flaschenhalter (konfiguriert)"
- [ ] Translation files: `configurator.products.glass_holder` in DE/EN korrekt
- [ ] Translation files: `configurator.parts.base` = "Grundplatte" / "Base plate"
- [ ] Translation files: `configurator.colors.ice_blue` = "Eisblau" / "Ice Blue"

---

## 🔒 CONSTRAINTS EINGEHALTEN

✅ **KEINE Refactors an:**
- NextAuth Session Management
- Middleware
- Stripe Webhook Flow (nur Felder hinzugefügt)

✅ **Bestehende Systeme genutzt:**
- Bestehender i18n Toggle (NICHT neu gebaut)
- Bestehende shipping_rates Tabelle
- Bestehende MwSt-Berechnung

✅ **Interne Speicherung:**
- Preise in cents (UI zeigt Euro)
- Exakte Color Names (mint, green, purple, ice_blue, dark_blue, red, black)
- Exakte Part Keys (base, arm, module, pattern, finish)

---

## 📦 DATEIEN GEÄNDERT/ERSTELLT

### TICKET 1 (4 Dateien):
- ✅ **ERSTELLT:** `public/iframe-language-bridge.js`
- ✅ **MODIFIZIERT:** `i18n.js`
- ✅ **MODIFIZIERT:** `public/i18n.js`
- ✅ **MODIFIZIERT:** `public/configurator.html`

### TICKET 2 (4 Dateien):
- ✅ **ERSTELLT:** `lib/utils/shipping.js`
- ✅ **MODIFIZIERT:** `prisma/schema.prisma`
- ✅ **ERSTELLT:** `prisma/migrations/20260108205130_add_shipping_region/migration.sql`
- ✅ **MODIFIZIERT:** `pages/api/webhooks/stripe.js`

### TICKET 3 (3 Dateien):
- ✅ **MODIFIZIERT:** `pages/admin/orders/[id].js`
- ✅ **MODIFIZIERT:** `public/translations/de.json`
- ✅ **MODIFIZIERT:** `public/translations/en.json`

**Gesamt:** 11 Dateien (4 neu, 7 modifiziert)

---

## 🎯 NÄCHSTE SCHRITTE

1. **Push to origin:**
   ```bash
   git push origin master
   ```

2. **Deploy to production:**
   - Vercel Deployment triggern
   - Prisma Migration ausführen (siehe oben)

3. **Acceptance Tests durchführen:**
   - 2 Test-Bestellungen (DE + EU) mit Screenshots
   - iFrame Sprach-Kommunikation testen
   - MwSt-Anzeige prüfen

4. **Optional – 3D-Konfigurator Update:**
   Falls der 3D-Konfigurator noch nicht auf `SET_LOCALE` Messages reagiert:
   - Im Konfigurator-Code `window.addEventListener('message', ...)` hinzufügen
   - Auf `event.data.type === 'SET_LOCALE'` prüfen
   - Sprache auf `event.data.locale` setzen

---

## 🐛 BEKANNTE EINSCHRÄNKUNGEN

1. **3D-Konfigurator muss Messages verarbeiten:**
   - `iframe-language-bridge.js` sendet korrekt
   - 3D-Konfigurator muss `postMessage` empfangen + verarbeiten
   - Falls nicht implementiert → Labels ändern sich noch nicht

2. **Legacy Orders:**
   - Alte Bestellungen ohne `shipping_region` zeigen keinen Region-Tag
   - Backfill möglich (siehe Migration SQL Kommentar)

3. **Translation Files:**
   - Nur für Homepage & Admin Panel
   - 3D-Konfigurator hat eigene Translation-Logik (nicht im Scope)

---

## ✨ ZUSAMMENFASSUNG

**Alle 3 Tickets erfolgreich implementiert:**
- ✅ TICKET 1: iFrame Locale-Bridge (postMessage + URL param)
- ✅ TICKET 2: Region-Ermittlung DE/EU/INT + MwSt 19%
- ✅ TICKET 3: Produktnamen konsistent + deutsche Begriffe

**Code Quality:**
- Minimale Änderungen (targeted edits, nicht komplettes Rebuild)
- Backward compatible (legacy orders weiterhin unterstützt)
- Constraints eingehalten (keine NextAuth/Middleware/Stripe-Flow Refactors)

**Ready for Production:**
- 3 saubere Commits (1 pro Ticket)
- Migration SQL bereit
- Acceptance Test Guide vorhanden

---

**Ende der Implementierung – 2026-01-08 20:54 CET**
