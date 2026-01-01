# 4:5 Produktbild Migration

## ✅ Durchgeführte Änderungen

### 1. **Zentrale ProductImage Komponente** (`components/ProductImage.jsx`)
- **Einheitliches 4:5 Hochformat** für alle Produktbilder
- **Fokus-Presets**: center, top, bottom (keine X/Y-Frickelei)
- **Automatischer Fallback** auf Placeholder bei fehlenden Bildern
- **Hover-Effekt** (Zoom)

### 2. **Datenbank-Schema** (`prisma/schema.prisma`)
- ❌ Entfernt: `imageFit`, `imagePosition` (komplex, unnötig)
- ✅ Neu: `imageFocus` (String: "center" | "top" | "bottom")
- Default: "center"

### 3. **Shop Integration** (`pages/shop.js`)
- Verwendet jetzt `<ProductImage>` Komponente
- Alte CSS-Styles entfernt
- Responsive Grid bleibt, aber Bilder immer 4:5

### 4. **Admin Integration**
- **ProductList** (`components/backend/ProductList.jsx`): Thumbnails im 4:5 Format
- **ProductForm** (`components/backend/ProductForm.jsx`):
  - Live-Preview im 4:5 Format (simuliert Shop-Ansicht)
  - Fokus-Dropdown mit 3 Optionen
  - Preview ändert sich sofort bei Fokus-Änderung

## 📋 Migration ausführen

### Supabase (Produktion)
```bash
# 1. Supabase Dashboard öffnen
# 2. SQL Editor öffnen
# 3. Datei ausführen:
supabase/migrations/005_add_image_focus.sql
```

### Prisma (Lokal)
```bash
# Migration erstellen
npx prisma migrate deploy

# Oder bei Dev-DB:
npx prisma migrate dev
```

## 🧪 Testen

1. **Shop-Ansicht**: `/shop`
   - Alle Bilder im 4:5 Format
   - Keine Verzerrung, sauberer Crop
   - Responsive Grid (1-4 Spalten je nach Screen)

2. **Admin Produktliste**: `/backend/products`
   - Thumbnails 120px breit, 4:5 Ratio
   - Saubere Darstellung

3. **Admin Produkt bearbeiten**:
   - Preview zeigt exakt wie im Shop
   - Fokus-Dropdown funktioniert (center/top/bottom)
   - Änderung wirkt sofort in Preview

4. **Fokus-Test**:
   - Produkt mit Flaschenbild erstellen
   - Fokus auf "top" setzen → Flaschenhals sichtbar
   - Fokus auf "bottom" → Flaschenboden sichtbar

## 🎯 Done-Kriterien

- ✅ Alle Produktbilder einheitlich 4:5 (Shop, Admin List, Admin Edit)
- ✅ Keine unterschiedlichen Aspect Ratios je Breakpoint
- ✅ Preview im Admin Edit = Shop-Darstellung
- ✅ Fokus-System funktioniert (3 Presets, Live-Preview)
- ✅ Kein Layout-Wackeln (Bilder laden mit Placeholder)
- ✅ Single Source of Truth (ProductImage Komponente)

## 🔧 Verwendung

### In React-Komponenten
```jsx
import ProductImage from '../components/ProductImage';

<ProductImage
  src={product.image_url}
  alt={product.name}
  focus={product.image_focus || 'center'}
  variant="default" // oder "small" für Thumbnails
/>
```

### Responsive Grid (Shop)
```css
.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

/* Bild bleibt immer 4:5, nur Anzahl Spalten ändert sich */
@media (max-width: 768px) {
  .shop-grid {
    grid-template-columns: repeat(2, 1fr); /* 2 Spalten Mobile */
  }
}
```

## 🚨 Breaking Changes

- Alte Props `aspect`, `fit`, `position` werden ignoriert
- Alle Bilder sind jetzt 4:5 (war vorher 4:3 im Shop)
- DB-Felder `image_fit`, `image_position` werden entfernt

## 📝 Nächste Schritte (optional)

- [ ] Migration in Production ausführen
- [ ] Bestehende Produktbilder prüfen und ggf. Fokus anpassen
- [ ] Bilder mit kritischen Bereichen auf "top" oder "bottom" setzen
- [ ] Placeholder-Bild im 4:5 Format erstellen
