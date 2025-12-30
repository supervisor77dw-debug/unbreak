# Multi-Item Cart Test Guide

## Ziel
Vollständiger Test des Warenkorb-Systems mit 2 verschiedenen Produkten (Menge 1 und 2), Checkout über Stripe und Verifizierung der Datenbank-Updates.

## Voraussetzungen
✅ Dev Server läuft: `npm run dev` → http://localhost:3000
✅ Stripe Webhook konfiguriert: https://unbreak-one.vercel.app/api/webhooks/stripe
✅ Supabase verbunden
✅ Test-Kreditkarte: `4242 4242 4242 4242`

---

## Test-Ablauf

### 1. Produkte zum Warenkorb hinzufügen

1. **Öffne Shop-Seite**: http://localhost:3000/shop
2. **Erstes Produkt**: Klicke auf "In den Warenkorb" bei einem Produkt
   - ✅ Cart Badge sollte erscheinen: 🛒 1
3. **Zweites Produkt**: Klicke auf "In den Warenkorb" bei einem ANDEREN Produkt
   - ✅ Cart Badge sollte aktualisieren: 🛒 2

### 2. Warenkorb anpassen

1. **Öffne Warenkorb**: Klicke auf 🛒 Badge oder navigiere zu `/cart`
2. **Menge ändern**: Bei einem Produkt auf `+` klicken
   - ✅ Menge sollte auf 2 erhöhen
   - ✅ Zwischensumme sollte aktualisieren
3. **Verifiziere Warenkorb**:
   - Produkt 1: Menge 1
   - Produkt 2: Menge 2
   - ✅ Gesamtsumme korrekt berechnet

### 3. Checkout durchführen

1. **Klicke "Zur Kasse"** im Warenkorb
2. **Warte auf Weiterleitung** zu Stripe Checkout
3. **Verifiziere Stripe Session**:
   - ✅ Beide Produkte sollten aufgelistet sein
   - ✅ Mengen korrekt (1x und 2x)
   - ✅ Preise korrekt

4. **Ausfüllen**:
   - Email: `test@example.com`
   - Karte: `4242 4242 4242 4242`
   - Ablauf: `12/34`
   - CVC: `123`
   - Name: `Test User`
   
5. **Zahlung abschließen**

### 4. Success Page verifizieren

Nach erfolgreicher Zahlung wirst du zu `/success.html` weitergeleitet:

✅ **Erwartetes Ergebnis**:
- Success-Meldung angezeigt
- Order ID sichtbar
- **Beide Items sollten aufgelistet sein**:
  - Produkt 1 (1x) mit Preis
  - Produkt 2 (2x) mit Preis
- Gesamtsumme korrekt
- Warenkorb wurde geleert (localStorage)

---

## Datenbank-Verifizierung

### In Supabase SQL Editor ausführen:

```sql
-- 1. Neueste Order anzeigen
SELECT 
  id,
  stripe_session_id,
  status,
  total_amount_cents,
  items,
  created_at,
  paid_at
FROM simple_orders
ORDER BY created_at DESC
LIMIT 1;
```

### ✅ Erwartete Werte:

| Feld | Erwartung |
|------|-----------|
| `status` | `'paid'` (nicht 'pending') |
| `paid_at` | Timestamp (nicht NULL) |
| `total_amount_cents` | Korrekte Summe (z.B. 5990 für 29.90€ + 29.90€) |
| `items` | JSONB Array mit 2 Objekten |

### 2. Items JSONB detailliert prüfen:

```sql
-- Items Array expandieren
SELECT 
  id,
  jsonb_array_length(items) as item_count,
  jsonb_pretty(items) as items_detail
FROM simple_orders
ORDER BY created_at DESC
LIMIT 1;
```

### ✅ Erwartetes items Format:

```json
[
  {
    "id": "uuid-produkt-1",
    "sku": "SKU-GLASS-01",
    "name": "Weinglas Halter",
    "quantity": 1,
    "price_cents": 2990
  },
  {
    "id": "uuid-produkt-2",
    "sku": "SKU-BOTTLE-01", 
    "name": "Flaschen Halter",
    "quantity": 2,
    "price_cents": 2990
  }
]
```

---

## Webhook-Verifizierung

### In Stripe Dashboard:

1. **Navigiere zu**: Developers → Webhooks
2. **Klicke auf**: dein Webhook Endpoint
3. **Tab**: Recent deliveries
4. **Neuester Eintrag**:
   - ✅ Status: `200 OK` (grünes Häkchen)
   - ✅ Event Type: `checkout.session.completed`
   - ✅ Response Body sollte leer sein (erfolgreiche Verarbeitung)

### In Vercel Logs:

Suche nach:
```
[WEBHOOK HIT] Method: POST
[SIGNATURE] Signature verified
[SESSION] Found session ID: cs_test_...
[DB UPDATE] Update result: rowCount=1
```

---

## Troubleshooting

### Problem: Cart Badge erscheint nicht
- **Lösung**: Browser Console öffnen, prüfe auf Fehler
- **Check**: localStorage hat Eintrag `unbreak_cart`

### Problem: Checkout leitet nicht zu Stripe
- **Lösung**: Browser Console prüfen
- **API Check**: `/api/checkout/standard` sollte 200 zurückgeben

### Problem: Order bleibt 'pending'
1. **Stripe Webhook URL prüfen**: Muss `https://unbreak-one.vercel.app/api/webhooks/stripe` sein
2. **Vercel Logs prüfen**: Webhook sollte POST erhalten
3. **RLS Policy prüfen**: service_role muss UPDATE auf simple_orders haben

### Problem: Items in DB sind NULL
- **Ursache**: Alte Checkout-Version ohne items[] Support
- **Lösung**: Stripe Session neu erstellen (neuer Checkout)
- **Check**: `/api/checkout/standard.js` muss `items.map()` haben (Zeile 239)

---

## Erfolgs-Kriterien

✅ **Test erfolgreich wenn:**
1. 2 verschiedene Produkte im Cart (mit Mengen 1 und 2)
2. Stripe Checkout zeigt beide Items korrekt
3. Zahlung mit 4242... erfolgreich
4. Success Page zeigt beide Items
5. `simple_orders.status = 'paid'`
6. `simple_orders.paid_at` ist gesetzt
7. `simple_orders.items` ist JSONB Array mit 2 Objekten
8. Stripe Webhook Delivery zeigt 200 OK
9. Warenkorb ist nach Success Page geleert

---

## Nächste Schritte nach erfolgreichem Test

- [ ] Toast-Benachrichtigungen für "Zum Warenkorb hinzugefügt"
- [ ] Cart Icon in Header-Navigation einbauen
- [ ] Produkt-Bilder in Cart Page anzeigen
- [ ] "Weiter einkaufen" Button auf Cart Page
- [ ] Email-Benachrichtigung nach Bestellung
- [ ] Admin-Bereich: Order-Details mit Items anzeigen
