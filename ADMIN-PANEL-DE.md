# Admin-Panel - Vollständige deutsche Version

## ✅ Fertiggestellte Funktionen

### 📊 Dashboard (`/admin`)
- **Statistik-Übersicht**
  - Bestellungen heute (mit Änderung zu gestern in %)
  - Offene Tickets
  - Tagesumsatz (mit prozentualer Änderung)
  - Offene Bestellungen (NEW/PROCESSING Status)
- **Schnellaktionen**
  - Neue Bestellungen bearbeiten
  - Offene Tickets anzeigen
  - Versandbereite Bestellungen
- **Sprache**: Komplett auf Deutsch

### 📦 Bestellverwaltung (`/admin/orders`)
- **Bestellliste**
  - Paginierung (20 Bestellungen pro Seite)
  - Suchfunktion (E-Mail, Bestellnummer)
  - Filter nach Zahlungsstatus
  - Filter nach Versandstatus
  - Deutsche Status-Badges (farbcodiert)
  - Sortierung nach Datum (neueste zuerst)
  
- **Bulk-Aktionen** ✨ NEU
  - Mehrfachauswahl per Checkbox
  - "Alle auswählen" Funktion
  - Massenänderung des Versandstatus:
    * → In Bearbeitung
    * → Versandt
    * → Abgeschlossen
    * → Stornieren
  - Bestätigung vor Ausführung
  
- **CSV-Export** ✨ NEU
  - Export-Button im Header
  - Deutsche Spaltennamen
  - Exportierte Felder:
    * Bestellnr., Datum, Kunde E-Mail, Kunde Name
    * Zahlungsstatus, Versandstatus
    * Artikel-Anzahl
    * Zwischensumme, Versand, MwSt., Gesamt
    * Bezahlt am, Versandt am
  - UTF-8 BOM für Excel-Kompatibilität
  - Dateiname: `bestellungen-YYYY-MM-DD.csv`

### 📄 Bestelldetails (`/admin/orders/[id]`)
- **Status-Verwaltung**
  - Zahlungsstatus-Dropdown (Ausstehend, Bezahlt, Fehlgeschlagen, Erstattet)
  - Versandstatus-Dropdown (Neu, In Bearbeitung, Versandt, Abgeschlossen, Storniert)
  - Live-Update per API
  
- **Informationen angezeigt**
  - Kundeninformationen (E-Mail, Name, Kunden-ID)
  - Lieferadresse (falls vorhanden)
  - Artikel-Tabelle (Produkt, SKU, Menge, Preise)
  - Summen (Zwischensumme, Versand, MwSt., Gesamt)
  - Zahlungsdetails (Stripe-IDs, Zeitstempel)
  - Aktivitätsprotokoll (alle Events chronologisch)
  - Interne Notizen (Textarea für Admin-Notizen)
  
- **Deutsche Übersetzung**
  - Alle Sections auf Deutsch
  - Deutsche Datumsformatierung (TT.MM.JJJJ)
  - Währung in Euro (€)

### 👥 Kundenverwaltung (`/admin/customers`) ✨ NEU
- **Kundenliste**
  - Suchfunktion (E-Mail, Name)
  - Spalten:
    * E-Mail (verlinkt)
    * Name
    * Telefon
    * Letzte Bestellung
    * Anzahl Bestellungen
    * Erstellt am
  - Sortierung: Neueste zuerst
  - Limit: 100 Kunden pro Anfrage

## 🔌 API-Endpunkte

### `/api/admin/stats` (GET)
**Zweck**: Dashboard-Statistiken  
**Authentifizierung**: Erforderlich (ADMIN/STAFF/SUPPORT)  
**Response**:
```json
{
  "ordersToday": 5,
  "ordersChange": 25,
  "openTickets": 0,
  "ticketsChange": 0,
  "revenueToday": 54900,
  "revenueChange": 15,
  "pendingOrders": 3
}
```

### `/api/admin/customers` (GET) ✨ NEU
**Zweck**: Kundenliste abrufen  
**Parameter**: `?search=email@example.com`  
**Authentifizierung**: Erforderlich  
**Response**:
```json
{
  "customers": [
    {
      "id": "uuid",
      "email": "kunde@example.com",
      "name": "Max Mustermann",
      "phone": "+49123456789",
      "lastOrderAt": "2025-12-31T10:00:00Z",
      "createdAt": "2025-12-01T10:00:00Z",
      "_count": {
        "orders": 5
      }
    }
  ]
}
```

### `/api/admin/orders` (GET)
**Zweck**: Bestellliste mit Paginierung  
**Parameter**:
- `page=1`
- `limit=20`
- `statusPayment=PAID`
- `statusFulfillment=NEW`
- `search=kunde@example.com`

### `/api/admin/orders/[id]` (GET, PATCH)
**GET**: Bestelldetails mit Relations (customer, items, events)  
**PATCH**: Update Status oder Notizen
```json
{
  "statusPayment": "PAID",
  "statusFulfillment": "SHIPPED",
  "notes": "Paket wurde versandt"
}
```

### `/api/admin/orders/export` (GET) ✨ NEU
**Zweck**: CSV-Export aller Bestellungen  
**Parameter**: `?format=csv` (Standard) oder `?format=json`  
**Response**: CSV-Download oder JSON

## 🎨 Design & UX

### Farbschema
- Hintergrund: `#0f0f0f` (Dunkel)
- Karten: `#1a1a1a` / `#262626`
- Borders: `#2a2a2a` / `#404040`
- Primärfarbe: `#0a4d4d` (Petrol)
- Text: `#d4f1f1` (Hell)
- Akzent: `#94a3b8` (Grau)

### Status-Farben
**Zahlung:**
- Ausstehend: `#fbbf24` (Gelb)
- Bezahlt: `#4ade80` (Grün)
- Fehlgeschlagen: `#ef4444` (Rot)
- Erstattet: `#a855f7` (Lila)

**Versand:**
- Neu: `#60a5fa` (Blau)
- In Bearbeitung: `#fbbf24` (Gelb)
- Versandt: `#34d399` (Grün)
- Abgeschlossen: `#4ade80` (Grün)
- Storniert: `#ef4444` (Rot)

### Responsive Design
- Mobile-optimierte Tabellen
- Flexibles Grid-Layout
- Touch-freundliche Buttons
- Overflow-Scroll bei Bedarf

## 🔐 Berechtigungen

**Rollen:**
- `ADMIN`: Voller Zugriff
- `STAFF`: Bestellungen + Kunden
- `SUPPORT`: Nur Ansicht

**Geschützte Bereiche:**
- Alle `/admin/*` Routen
- Alle `/api/admin/*` Endpunkte
- Session-basierte Authentifizierung (NextAuth.js)

## 📱 Navigation

**Hauptmenü** (AdminLayout):
```
Dashboard      → /admin
Bestellungen   → /admin/orders
Kunden         → /admin/customers
Tickets        → /admin/tickets (Platzhalter)
Einstellungen  → /admin/settings (Platzhalter)
```

## 🚀 Deployment

**Vercel Integration:**
- Auto-Deploy bei Git Push
- Environment Variables:
  * `DATABASE_URL`
  * `NEXTAUTH_SECRET`
  * `NEXTAUTH_URL`
  * `STRIPE_SECRET_KEY`
  * `STRIPE_WEBHOOK_SECRET`

**Build-Kommando**: `npm run build`  
**Start-Kommando**: `npm start`

## 📊 Prisma Schema

**Tabellen:**
- `admin_users` - Admin-Benutzer
- `admin_customers` - Kundendatenbank
- `admin_orders` - Bestellungen
- `admin_order_items` - Bestellpositionen
- `admin_order_events` - Aktivitätsprotokoll
- `admin_tickets` - Support-Tickets (optional)
- `admin_refunds` - Erstattungen (optional)

## ✅ Erfolgreich migriert

**Historische Daten:**
- 12 Bestellungen in admin_orders
- 11 Shop-Bestellungen (simple_orders → admin_orders)
- 1 Konfigurator-Bestellung (orders → admin_orders)
- 3 Kunden in admin_customers
- ~25 Bestellpositionen

**Webhook-Integration:**
- Dual-Checkout-System unterstützt
- Auto-Sync für neue Bestellungen
- Stripe-Session-Verfolgung
- Event-Logging aktiviert

## 🎯 Nächste Schritte (Optional)

### Empfohlene Features:
1. **E-Mail-Benachrichtigungen**
   - Versandbestätigung
   - Statusänderungen
   - Bestellbestätigung
   
2. **Ticket-System**
   - Kundensupport-Tickets
   - Internes Messaging
   - Status-Workflow
   
3. **Produktverwaltung**
   - Produktliste
   - Preisänderungen
   - Lagerbestand
   
4. **Analytics**
   - Umsatz-Charts
   - Bestseller-Produkte
   - Kundenanalyse
   
5. **Versandlabels**
   - DHL/DPD Integration
   - Label-Druck
   - Tracking-Nummern

## 📝 Verwendung

### CSV-Export nutzen:
1. Gehe zu `/admin/orders`
2. Klicke auf "📥 Als CSV exportieren"
3. Datei wird heruntergeladen
4. In Excel/Google Sheets öffnen

### Bulk-Aktionen verwenden:
1. Gehe zu `/admin/orders`
2. Wähle Bestellungen per Checkbox aus
3. Wähle Aktion aus Dropdown
4. Klicke "Anwenden"
5. Bestätige die Änderung

### Status aktualisieren:
1. Öffne Bestellung (`/admin/orders/[id]`)
2. Wähle neuen Status aus Dropdown
3. Status wird automatisch gespeichert
4. Event wird im Aktivitätsprotokoll aufgezeichnet

## 🌐 Live-URL

**Admin-Panel**: https://unbreak-one.vercel.app/admin  
**Login**: NextAuth.js Session erforderlich

---

**Stand**: 31. Dezember 2025  
**Version**: 1.0.0 - Deutsches Vollrelease  
**Status**: ✅ Produktionsbereit
