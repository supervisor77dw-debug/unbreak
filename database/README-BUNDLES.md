# Shop Bundles hinzufügen

## Neue Produkte
Dieses Update fügt 2 neue Bundle-Produkte zum Shop hinzu:

### 1. Gastro Edition (4 Glashalter + 2 Flaschenhalter)
- **SKU**: `UO-BUNDLE-GASTRO`
- **Preis**: 299,00 EUR
- **Ersparnis**: ~24% gegenüber Einzelkauf (394 EUR)
- **Zielgruppe**: Restaurants, Bars, professionelle Gastronomie

### 2. Starter Bundle (2 Glashalter)
- **SKU**: `UO-BUNDLE-STARTER`  
- **Preis**: 109,00 EUR
- **Ersparnis**: ~8% gegenüber Einzelkauf (118 EUR)
- **Zielgruppe**: Privatpersonen, kleine Küchen, Geschenk

## Installation

### Option 1: Supabase SQL Editor (Empfohlen)
1. Öffne Supabase Dashboard: https://supabase.com/dashboard
2. Wähle dein Projekt aus
3. Gehe zu **SQL Editor**
4. Erstelle neue Query
5. Kopiere den Inhalt von `database/add-bundles.sql`
6. Klicke auf **RUN**
7. Verifiziere mit der SELECT-Query am Ende

### Option 2: Node.js Script
```bash
node scripts/add-bundles.js
```

## Produktübersicht (nach Update)

| SKU | Name | Inhalt | Preis | Rabatt |
|-----|------|--------|-------|--------|
| UO-PREMIUM-SET | Premium Set | 2 Glas + 1 Flasche | 149,00 € | ~15% |
| UO-GLASS-HOLDER | Weinglashalter | 1 Glas | 59,00 € | - |
| UO-BOTTLE-HOLDER | Flaschenhalter | 1 Flasche | 79,00 € | - |
| UO-BUNDLE-GASTRO | Gastro Edition | 4 Glas + 2 Flasche | 299,00 € | ~24% |
| UO-BUNDLE-STARTER | Starter Bundle | 2 Glas | 109,00 € | ~8% |

## Bilderzuordnung
Die Funktion `getProductImage()` in `pages/shop.js` ordnet automatisch zu:
- Starter Bundle  `glass-holder.jpg` (enthält "glass" im Namen)
- Gastro Edition  `premium-set.jpg` (enthält "set" im Namen)

## Rollback
Falls nötig, kannst du die Produkte wieder entfernen:
```sql
DELETE FROM products WHERE sku IN ('UO-BUNDLE-GASTRO', 'UO-BUNDLE-STARTER');
```
