# 👨‍💼 Ops Dashboard – Mitarbeiter-Handbuch

**UNBREAK ONE – Operations Portal für Staff**

---

## 📋 Überblick

Das **Ops Dashboard** (`/ops`) ist die zentrale Schnittstelle für Mitarbeiter (Staff-Rolle), um den Shop im Tagesgeschäft zu betreiben – **ohne Entwicklerzugriff**.

**Zugriff:** Nur für Benutzer mit Rolle `staff` oder `admin`  
**Login:** `/login.html` → Auto-Redirect zu `/ops`

---

## 🔐 Zugriff

### Voraussetzungen
1. **Account** mit Rolle `staff` oder `admin`
2. **Login** über `/login.html`
3. **Auto-Redirect** zu `/ops` nach Login

### Berechtigungen

| Funktion | staff | admin |
|----------|-------|-------|
| Bestellungen ansehen | ✅ | ✅ |
| Bestellstatus ändern | ✅ | ✅ |
| Tracking-Nummer setzen | ✅ | ✅ |
| Bundles/Presets erstellen/bearbeiten | ✅ | ✅ |
| Bundles/Presets löschen | ❌ | ✅ |
| Produkt-Texte bearbeiten | ✅ | ✅ |
| Produkt-Preise ändern | ❌ | ✅ |
| User-Rollen ändern | ❌ | ✅ |

---

## 🛍️ Ops-Bereiche

### 1. Orders Dashboard (`/ops.html`)

**Funktionen:**
- ✅ Übersicht aller Bestellungen
- ✅ Filter nach Status
- ✅ Sortierung (Datum, Betrag)
- ✅ Status ändern
- ✅ Tracking-Nummer setzen
- ✅ Interne Notizen

**Statistiken (oben):**
- Gesamt-Bestellungen
- Ausstehend (pending)
- In Bearbeitung (processing)
- Versandt (shipped)

---

### 2. Katalog-Verwaltung (`/ops/catalog.html`)

**3 Tabs:**

#### Tab 1: Produkte (Read-Only)
- Anzeige aller Standard-Produkte
- Ansicht: SKU, Name DE/EN, Preis, Status, Bild
- **Keine Bearbeitung** (nur Admin kann Preise ändern)

#### Tab 2: Bundles (CRUD)
**Was sind Bundles?** Produktpakete (z.B. "Gastro 10er Set")

**Funktionen:**
- ✅ Neue Bundles erstellen
- ✅ Bundles bearbeiten (Titel, Beschreibung, Preis, Bild, Items)
- ✅ Bundles aktivieren/deaktivieren
- ❌ Löschen (nur Admin)

**Bundle-Editor:**
- Titel DE/EN
- Beschreibung DE/EN
- Preis (€)
- Bild-URL
- **Bundle-Items:** Dynamische Liste von SKU + Menge
  - Beispiel: `UO-GLASSHOLDER` × 4, `UO-BOTTLEHOLDER` × 2

#### Tab 3: Presets (CRUD)
**Was sind Presets?** Vorkonfigurierte Produkte (z.B. "Schwarz/Gold Premium")

**Funktionen:**
- ✅ Neue Presets erstellen
- ✅ Presets bearbeiten (Titel, Beschreibung, Preis, Config)
- ✅ Presets aktivieren/deaktivieren
- ❌ Löschen (nur Admin)

**Preset-Editor:**
- Titel DE/EN
- Beschreibung DE/EN
- Preis (€)
- Produkt-SKU (z.B. `UO-CONFIGURED`)
- **Config JSON:** Konfiguration als JSON
  - Erlaubte Felder: `finish`, `magnet`, `quantity`, `color`, `material`
  - Beispiel:
    ```json
    {
      "finish": "matte-black",
      "magnet": "gold",
      "quantity": 1
    }
    ```

---

## 📊 Orders Dashboard – Detailansicht

### Bestellübersicht

**Anzeige pro Bestellung:**
```
┌─────────────────────────────────────────┐
│ Bestellung #abc12345      [Status]      │
│ 27.12.2025 19:30                        │
│                                         │
│ Kunde:    customer@example.com          │
│ Produkt:  UO-GLASSHOLDER                │
│ Menge:    2                             │
│ Betrag:   €158.00                       │
│ Tracking: DHL123456789 (optional)       │
│                                         │
│ [Bearbeiten]                            │
└─────────────────────────────────────────┘
```

### Filter & Sortierung

**Status-Filter:**
- Alle
- Ausstehend (pending)
- Bestätigt (confirmed)
- In Bearbeitung (processing)
- Versandt (shipped)
- Zugestellt (delivered)
- Storniert (cancelled)

**Sortierung:**
- Neueste zuerst
- Älteste zuerst
- Betrag (aufsteigend)
- Betrag (absteigend)

---

## ✏️ Bestellung bearbeiten

### Workflow

1. **Bestellung finden** (Filter nutzen)
2. **"Bearbeiten" klicken**
3. **Modal öffnet sich** mit Feldern:
   - Status (Dropdown)
   - Tracking-Nummer (Text)
   - Interne Notizen (Textarea)
4. **Speichern**
5. **Bestellung aktualisiert** in Datenbank

### Status-Übergänge

**Typischer Workflow:**
```
pending → confirmed → processing → shipped → delivered
```

**Alternative:**
```
pending → cancelled (bei Stornierung)
```

### Tracking-Nummer

**Format:** Freitext (z.B. `DHL1234567890`)

**Verwendung:**
- Wird in Customer-Account angezeigt
- Optional: Automatische Tracking-Link-Generierung (zukünftig)

---

## 🛒 Katalog-Verwaltung – Workflows

### Neues Bundle erstellen

1. **Ops Catalog öffnen:** `/ops/catalog.html`
2. **Tab "Bundles"** auswählen
3. **"Neues Bundle" klicken**
4. **Formular ausfüllen:**
   - Titel DE: `Gastro Starter Set`
   - Titel EN: `Gastro Starter Set`
   - Beschreibung DE: `Perfekt für kleine Restaurants...`
   - Beschreibung EN: `Perfect for small restaurants...`
   - Preis: `249.00` (€)
   - Bild-URL: `https://...` (optional)
5. **Bundle-Items hinzufügen:**
   - Zeile 1: SKU `UO-GLASSHOLDER`, Menge `4`
   - Zeile 2: SKU `UO-BOTTLEHOLDER`, Menge `2`
   - [+ Artikel hinzufügen] für weitere Items
6. **Aktiv:** ✓ (Häkchen setzen)
7. **Speichern**
8. **Fertig!** Bundle erscheint sofort im Shop (`/shop.html`)

---

### Neues Preset erstellen

1. **Tab "Presets"** auswählen
2. **"Neues Preset" klicken**
3. **Formular ausfüllen:**
   - Titel DE: `Schwarz/Gold Premium`
   - Titel EN: `Black/Gold Premium`
   - Beschreibung: `Matte black finish with gold magnet...`
   - Preis: `89.00` (€)
   - Produkt-SKU: `UO-CONFIGURED`
   - **Config JSON:**
     ```json
     {
       "finish": "matte-black",
       "magnet": "gold",
       "quantity": 1
     }
     ```
4. **Aktiv:** ✓
5. **Speichern**
6. **Fertig!** Preset erscheint im Shop

**Wichtig:** Config JSON wird validiert – nur erlaubte Felder:
- `finish`, `magnet`, `quantity`, `color`, `material`

---

### Bundle bearbeiten

1. **Tab "Bundles"**
2. **Bundle in Liste finden**
3. **"Bearbeiten" klicken**
4. **Änderungen vornehmen:**
   - Preis aktualisieren
   - Items hinzufügen/entfernen
   - Texte anpassen
5. **Speichern**
6. **Aktualisierung** erscheint sofort im Shop

---

### Bundle deaktivieren (statt löschen)

**Warum deaktivieren?**
- Bundle bleibt in Datenbank (Bestellhistorie intakt)
- Verschwindet aus Shop
- Kann später reaktiviert werden

**Workflow:**
1. **Bundle bearbeiten**
2. **Häkchen "Aktiv"** entfernen
3. **Speichern**
4. **Bundle nicht mehr im Shop** sichtbar

---

## 🔒 Sicherheit & Einschränkungen

### Was Staff KANN

✅ Bestellungen ansehen (alle)  
✅ Bestellstatus ändern  
✅ Tracking-Nummern setzen  
✅ Bundles/Presets erstellen/bearbeiten  
✅ Bundles/Presets aktivieren/deaktivieren  
✅ Produkt-Texte bearbeiten (zukünftig)

### Was Staff NICHT KANN

❌ Bundles/Presets löschen (nur Admin)  
❌ Produkt-Preise ändern (nur Admin)  
❌ User-Rollen ändern (nur Admin)  
❌ Supabase-Dashboard-Zugriff (keine Datenbankrechte)  
❌ Stripe-Dashboard-Zugriff (keine Zahlungsrechte)

### Datenbank-Schutz (RLS)

**Supabase Row Level Security (RLS) schützt:**
- Staff kann nur UPDATE auf Orders/Bundles/Presets
- Kein DELETE (außer Admin)
- Kein Zugriff auf `profiles.role` (eigene Rolle ändern)

**Server-Side Validierung:**
- API Routes prüfen Rolle (`requireRole(['staff', 'admin'])`)
- Frontend-Checks sind nur UX (Server muss nochmal prüfen)

---

## 🧪 Typische Workflows

### Workflow 1: Neue Bestellung bearbeiten

**Szenario:** Kunde bestellt Produkt, Zahlung erfolgreich

1. **Ops öffnen:** `/ops`
2. **Statistik prüfen:** "Ausstehend" zeigt neue Order
3. **Filter:** Status = "pending"
4. **Bestellung finden**
5. **"Bearbeiten" klicken**
6. **Status ändern:** `pending` → `confirmed`
7. **Speichern**
8. **Produktion:** Order erscheint in `production_jobs` (automatisch via Webhook)

---

### Workflow 2: Versand abwickeln

**Szenario:** Produkt produziert, wird versandt

1. **Filter:** Status = "processing"
2. **Bestellung finden**
3. **"Bearbeiten" klicken**
4. **Status ändern:** `processing` → `shipped`
5. **Tracking-Nummer eingeben:** z.B. `DHL1234567890`
6. **Interne Notizen:** "Versandt am 27.12.2025 via DHL"
7. **Speichern**
8. **Kunde sieht** Tracking-Nummer in Account (`/account.html`)

---

### Workflow 3: Saisonales Bundle erstellen

**Szenario:** Weihnachts-Bundle für Gastro

1. **Ops Catalog öffnen:** `/ops/catalog.html`
2. **Tab "Bundles"**
3. **"Neues Bundle"**
4. **Formular:**
   - Titel DE: `Weihnachts-Bundle Gastro`
   - Titel EN: `Christmas Bundle Gastro`
   - Preis: `299.00`
   - Items:
     - `UO-GLASSHOLDER` × 6
     - `UO-BOTTLEHOLDER` × 4
   - Bild: `https://.../christmas-bundle.jpg`
   - Aktiv: ✓
5. **Speichern**
6. **Marketing:** Bundle ist live auf `/shop.html`

**Nach Saison:**
- Bundle bearbeiten → **Aktiv** deaktivieren
- Bundle bleibt in DB (für Bestellhistorie)

---

### Workflow 4: Preset-Nachfrage prüfen

**Szenario:** Welches Preset wird am meisten gekauft?

1. **Ops öffnen:** `/ops`
2. **Nach Presets filtern** (zukünftig: Advanced Filter)
3. **Manuelle Analyse:** Bestellungen durchsehen
4. **Entscheidung:** Beliebtes Preset als Standard anbieten

**Alternative (zukünftig):**
- Analytics Dashboard
- Automatische Reports

---

## 📚 Häufige Fragen (FAQ)

### Q: Kann ich Produkt-Preise ändern?

**A:** Nur als **Admin**. Staff kann Texte bearbeiten, aber keine Preise.

**Grund:** Preise sind vertraglich relevant und müssen zentral verwaltet werden.

---

### Q: Wie lösche ich ein Bundle?

**A:** **Deaktivieren** statt löschen!

**Workflow:**
1. Bundle bearbeiten
2. Häkchen "Aktiv" entfernen
3. Speichern

**Löschen:** Nur Admin kann Bundles komplett löschen (über SQL oder Admin-UI).

---

### Q: Was passiert, wenn ich ein aktives Bundle deaktiviere?

**A:**
- Bundle verschwindet sofort aus Shop (`/shop.html`)
- Bestehende Bestellungen bleiben intakt (Datenbank-Referenz)
- Bundle kann später reaktiviert werden

---

### Q: Wie setze ich eine Tracking-Nummer?

**A:**
1. Bestellung bearbeiten
2. Feld "Tracking-Nummer" ausfüllen (z.B. `DHL1234567890`)
3. Speichern
4. Kunde sieht Tracking in `/account.html`

---

### Q: Können Kunden ihre eigenen Bestellungen bearbeiten?

**A:** **Nein.** Kunden können nur ansehen, nicht bearbeiten.

**Änderungen:** Nur Staff/Admin via Ops Dashboard.

---

### Q: Wie erstelle ich ein neues Standard-Produkt?

**A:** Aktuell **nicht über Ops UI möglich**.

**Workaround:**
1. Admin öffnet Supabase Dashboard
2. SQL Editor: `INSERT INTO products (...) VALUES (...)`
3. Oder: Admin-Portal nutzen (falls vorhanden)

**Zukünftig:** Products-CRUD in Ops Catalog.

---

### Q: Was ist der Unterschied zwischen Bundle und Preset?

**A:**

| Bundle | Preset |
|--------|--------|
| **Mehrere Produkte** als Set | **Ein Produkt** vorkonfiguriert |
| Beispiel: 4× Glashalter + 2× Flaschenhalter | Beispiel: Schwarz/Gold Glashalter |
| `items_json`: Array von `{sku, qty}` | `config_json`: Konfiguration |
| Preis: Summe aller Items (reduziert) | Preis: Single Product Preis |

---

### Q: Kann ich Bundles und Presets gleichzeitig bearbeiten?

**A:** Ja, über **Tabs wechseln**:
- Tab "Bundles" → Bundle bearbeiten
- Tab "Presets" → Preset bearbeiten
- Änderungen werden sofort gespeichert

---

## 🛠️ Troubleshooting

### Problem: Bestellung wird nicht angezeigt

**Mögliche Ursachen:**
1. **Filter aktiv** → "Alle" auswählen
2. **Sortierung** → "Neueste zuerst" probieren
3. **Browser-Cache** → Seite neu laden (Ctrl+R)
4. **RLS-Problem** → Logout + Login

**Lösung:**
- Filter zurücksetzen
- Seite neu laden
- Bei Fehler: Admin kontaktieren

---

### Problem: "Speichern" funktioniert nicht

**Checkliste:**
1. **Pflichtfelder ausgefüllt?**
   - Titel DE/EN
   - Preis
   - Bei Bundles: Mindestens 1 Item
   - Bei Presets: Gültige Config JSON
2. **Validierung bestanden?**
   - Preset Config JSON: Nur erlaubte Felder
   - Preis: Positive Zahl
3. **Internet-Verbindung** aktiv?
4. **Browser-Console** (F12) auf Fehler prüfen

**Fehler "Invalid JSON":**
- Preset Config JSON überprüfen
- Syntax-Fehler beheben (z.B. fehlende Kommas)
- Validator nutzen: https://jsonlint.com

---

### Problem: Bundle erscheint nicht im Shop

**Checkliste:**
1. **Aktiv-Status:** Häkchen gesetzt?
2. **Gespeichert?** Bestätigung erschienen?
3. **Shop-Cache:** `/shop.html` neu laden (Ctrl+Shift+R)
4. **Supabase Query:** In Browser-Console prüfen

**Debug:**
```javascript
// Browser-Console in /shop.html
const { data } = await supabase
  .from('bundles')
  .select('*')
  .eq('active', true);
console.log(data);  // Bundle sollte hier erscheinen
```

---

### Problem: Tracking-Nummer wird nicht angezeigt

**Checkliste:**
1. **Korrekt gespeichert?** Order bearbeiten → Tracking-Feld prüfen
2. **Customer-Account:** Kunde muss eingeloggt sein
3. **RLS-Policy:** Customer kann nur eigene Orders sehen

**Workaround:**
- Tracking manuell per Email senden
- Customer-Support kontaktieren

---

## 📖 Weiterführende Dokumentation

| Dokument | Zweck |
|----------|-------|
| [AUTH-STATUS.md](../AUTH-STATUS.md) | Auth-System Status & Setup |
| [ROLES-ACCESS.md](../ROLES-ACCESS.md) | Rollen & Berechtigungen |
| [CATALOG-GUIDE.md](../CATALOG-GUIDE.md) | Katalog-System Technical Guide |
| [CATALOG-IMPLEMENTATION.md](../CATALOG-IMPLEMENTATION.md) | Katalog-Implementation Details |

---

## ✅ Checkliste: Tägliche Ops-Aufgaben

### Morgens
- [ ] Ops Dashboard öffnen (`/ops`)
- [ ] Neue Bestellungen prüfen (Filter: "Ausstehend")
- [ ] Status aktualisieren (`pending` → `confirmed`)
- [ ] Statistiken prüfen

### Tagsüber
- [ ] Bestellungen in Produktion (`confirmed` → `processing`)
- [ ] Fertige Produkte versenden (`processing` → `shipped`)
- [ ] Tracking-Nummern eintragen
- [ ] Kunden-Rückfragen beantworten

### Abends
- [ ] Alle versandten Orders checken
- [ ] Interne Notizen aktualisieren
- [ ] Nächste Tages-Planung (Produktion)
- [ ] Logout

### Wöchentlich
- [ ] Katalog prüfen (veraltete Bundles/Presets)
- [ ] Saisonale Produkte aktualisieren
- [ ] Bundle-Performance analysieren (manuell)
- [ ] Admin-Rücksprache (Preisänderungen, neue Produkte)

---

**Erstellt:** 27. Dezember 2025  
**Version:** 1.0  
**Autor:** GitHub Copilot  
**Für:** UNBREAK ONE Staff
