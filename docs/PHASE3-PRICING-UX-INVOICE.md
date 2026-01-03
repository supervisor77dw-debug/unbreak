# Phase 3: Pricing Matrix, UX Texts & Invoice Structure

**Status:** ✅ Complete  
**Date:** 2026-01-03  
**Focus:** Concrete pricing, customer-facing UX, legal compliance

---

## 🎯 Objectives

Phase 3 finalizes:
1. **Concrete Pricing Matrix** – Authoritative prices (not placeholders)
2. **Customer-facing UX Texts** – German, premium tone, no technical terms
3. **Legally compliant Invoice Structure** – VAT, accounting, German law

**NOT in scope:** Visual design, cart UI redesign

---

## 💰 Pricing Matrix (lib/pricing/pricing.config.ts)

### Configuration
```typescript
export const PRICING_CONFIG = {
  version: 'v1.2026-01-03',
  currency: 'EUR',
  vat: { defaultRate: 0.19 }, // German VAT 19%
  
  customizationFee: {
    netPrice: 19.00,  // Updated from €15.00
    qty: 1            // Always 1 per design
  },
  
  premiumAddons: [
    { key: 'ADDON_WOOD_INLAY', netPrice: 24.00, category: 'materials' },
    { key: 'ADDON_METAL_RING', netPrice: 18.00, category: 'materials' },
    { key: 'ADDON_CUSTOM_COLOR_RAL', netPrice: 29.00, category: 'coating' },
    { key: 'ADDON_CUSTOM_COLOR_HEX', netPrice: 39.00, category: 'coating' },
    { key: 'ADDON_ENGRAVING_TEXT', netPrice: 14.00, category: 'engraving' },
    { key: 'ADDON_ENGRAVING_LOGO', netPrice: 32.00, category: 'engraving' },
    { key: 'ADDON_GIFT_BOX', netPrice: 12.00, category: 'packaging' },
    { key: 'ADDON_PREMIUM_PACKAGING', netPrice: 19.00, category: 'packaging' }
  ]
}
```

### Helper Functions
- `calculateGross(net, vatRate)` – Net to gross conversion
- `formatPrice(amount, currency)` – German locale (152,00 €)
- `getAddonPrice(key)` – Lookup addon price
- `validateAddonKeys(keys)` – Hard-fail validation

### Integration
```typescript
import { PRICING_CONFIG, calculateGross, formatPrice } from '@/lib/pricing/pricing.config';

const gross = calculateGross(152.00, 0.19); // 180.88
const formatted = formatPrice(gross, 'EUR'); // "180,88 €"
```

---

## 💬 UX Texts (lib/i18n/ux-texts.ts)

### Product Title Template
```typescript
productTitle.template = '{baseProductName} – individuelles Design';

// Example:
getProductTitle('Glashalter 2er Set') 
// → "Glashalter – individuelles Design"
```

### Price Breakdown Labels
```typescript
priceBreakdown: {
  base: 'Basisprodukt',
  customization: 'Individualisierung',
  premiumAddons: 'Optionale Komponenten',
  subtotalNet: 'Gesamt (netto)',
  vat: 'inkl. MwSt. (19%)',
  totalGross: 'Gesamt'
}
```

### Addon Labels (Customer-facing)
```typescript
premiumAddons: {
  ADDON_WOOD_INLAY: 'Holzsockel',
  ADDON_METAL_RING: 'Metallring',
  ADDON_CUSTOM_COLOR_RAL: 'RAL-Farbe',
  ADDON_CUSTOM_COLOR_HEX: 'Individuelle Farbe',
  ADDON_ENGRAVING_TEXT: 'Textgravur',
  ADDON_ENGRAVING_LOGO: 'Logo-Gravur',
  ADDON_GIFT_BOX: 'Geschenkbox',
  ADDON_PREMIUM_PACKAGING: 'Premium-Verpackung'
}
```

### Invoice Structure
```typescript
invoice: {
  lineTitle: '{baseProductName} – individuelles Design',
  lineDescription: 'Dieses Produkt wird speziell nach Ihrer Konfiguration angefertigt.',
  breakdown: {
    baseProduct: 'inkl. Basisprodukt',
    customization: 'inkl. Individualisierung',
    premiumAddons: 'inkl. Sonderkomponenten: {labels}'
  },
  legalNotices: {
    customProduct: 'Individuell gefertigtes Produkt',
    productionTime: 'Produktionszeit: 5-7 Werktage ab Zahlungseingang',
    noReturn: 'Individualisierte Produkte sind vom Widerrufsrecht ausgeschlossen (§ 312g Abs. 2 Nr. 1 BGB)'
  }
}
```

### Error Messages (Customer-friendly)
```typescript
errors: {
  priceMismatch: 'Der Preis konnte nicht berechnet werden. Bitte aktualisieren Sie die Seite.',
  invalidDesign: 'Ihre Konfiguration konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
  unknownAddon: 'Eine gewählte Komponente ist nicht verfügbar.'
}
```

---

## 🧾 Invoice Generator (lib/invoice/invoice-generator.ts)

### Interface
```typescript
interface InvoiceLineItem {
  position: number;
  title: string;
  description: string;
  quantity: number;
  unitPriceNet: number;
  lineTotalNet: number;
  vatRate: number;
  lineTotalGross: number;
  breakdown?: {
    baseProduct: { sku: string; priceNet: number };
    customization: { feeKey: string; priceNet: number };
    premiumAddons: Array<{ addonKey: string; priceNet: number; label: string }>;
  };
  type: string;
  designId?: string;
}
```

### Invoice Generation
```typescript
import { generateInvoice } from '@/lib/invoice/invoice-generator';

const invoice = generateInvoice({
  orderId: 'ord_2026_001234',
  orderNumber: 'ORD-2026-001234',
  lineItems: cartItems,
  customer: customerData
});
```

### VAT Handling
- **VAT applied to total** (not per line)
- German standard rate: 19%
- Net prices stored, gross calculated
- VAT amount shown separately

### Legal Compliance
```typescript
notes: [
  'Individuell gefertigtes Produkt',
  'Produktionszeit: 5-7 Werktage ab Zahlungseingang',
  'Individualisierte Produkte sind vom Widerrufsrecht ausgeschlossen (§ 312g Abs. 2 Nr. 1 BGB)'
]
```

### Accounting Breakdown
```typescript
_accounting: {
  revenueByCategory: {
    baseProducts: 89.00,
    customizationServices: 19.00,
    premiumComponents: 63.00
  },
  revenueByCategoryDetailed: {
    baseProducts: { 'UNBREAK-GLAS-SET-2': 89.00 },
    customizationServices: { 'CUSTOM_DESIGN_FEE': 19.00 },
    premiumComponents: {
      materials: { 'ADDON_WOOD_INLAY': 24.00 },
      coating: { 'ADDON_CUSTOM_COLOR_HEX': 39.00 }
    }
  }
}
```

### Invoice Text Format (German)
```typescript
import { formatInvoiceText } from '@/lib/invoice/invoice-generator';

const text = formatInvoiceText(invoice);
```

Output:
```
RECHNUNG
─────────────────────────────────────────

Rechnungsnummer: RE-2026-001234
Rechnungsdatum: 2026-01-03
Bestellnummer: ORD-2026-001234

Kunde:
Max Mustermann
Musterstraße 123
10115 Berlin

Positionen:
─────────────────────────────────────────

1. Glashalter – individuelles Design
   Dieses Produkt wird speziell nach Ihrer Konfiguration angefertigt.
   
   inkl. Basisprodukt
   inkl. Individualisierung
   inkl. Sonderkomponenten: Holzsockel, Individuelle Farbe
   
   Menge: 1
   Einzelpreis (netto): 152,00 €
   Gesamt (netto): 152,00 €

─────────────────────────────────────────

Zwischensumme (netto): 152,00 €
MwSt. (19%): 28,88 €

GESAMTBETRAG: 180,88 €

─────────────────────────────────────────

Hinweise:
• Individuell gefertigtes Produkt
• Produktionszeit: 5-7 Werktage ab Zahlungseingang
• Individualisierte Produkte sind vom Widerrufsrecht ausgeschlossen (§ 312g Abs. 2 Nr. 1 BGB)
```

---

## 📊 Example Order/Invoice

See `EXAMPLE-ORDER-INVOICE-PHASE3.json`:
- Complete order object
- Invoice representation
- Customer-facing view
- Accounting breakdown
- Validation rules

### Example Calculation
```
Base Product (UNBREAK-GLAS-SET-2):  89,00 € (net)
Customization Fee:                  19,00 € (net)
Premium Addon (Wood):               24,00 € (net)
Premium Addon (Custom Color):       39,00 € (net)
──────────────────────────────────────────
Subtotal (net):                    152,00 €
VAT (19%):                          28,88 €
──────────────────────────────────────────
TOTAL (gross):                     180,88 €
```

---

## 🔒 Business Rules

### Pricing Rules
1. **Customization fee ALWAYS €19.00** (qty=1, net)
2. **Premium addons ONLY if selected** (never forced)
3. **Base product from catalog** (single source of truth)
4. **VAT 19%** (German standard)

### UX Rules
1. **NO internal SKUs** shown to customers
2. **NO technical keys** (ADDON_WOOD_INLAY → "Holzsockel")
3. **German language** (primary market)
4. **Premium tone** (calm, professional)

### Invoice Rules
1. **VAT to total** (not per line)
2. **Legal notices** (§ 312g Abs. 2 Nr. 1 BGB)
3. **Production time** (5-7 Werktage)
4. **Accounting split** (internal only)

### Validation Rules (Hard-fail)
1. `customization.enabled=true` → customization fee MUST exist
2. All `premiumAddons[].pricingKey` MUST be known in config
3. Client price MUST match server price
4. Pricebook version MUST match

---

## 🧪 Testing Checklist

### Pricing Tests
- [ ] Customization fee always €19.00
- [ ] Premium addon prices match config
- [ ] VAT calculation (19%)
- [ ] Gross = Net × 1.19
- [ ] Price formatting (German locale)

### UX Tests
- [ ] Product title template correct
- [ ] No internal SKUs visible
- [ ] Addon labels customer-friendly
- [ ] Error messages clear
- [ ] German text correct

### Invoice Tests
- [ ] VAT applied to total
- [ ] Legal notices present
- [ ] Accounting breakdown correct
- [ ] Invoice text formatted correctly
- [ ] Production time shown

### Validation Tests
- [ ] Unknown addon key → hard-fail
- [ ] Price mismatch → hard-fail
- [ ] Pricebook version mismatch → hard-fail
- [ ] Missing customization fee → hard-fail

---

## 📦 Integration Steps

### 1. Update Cart Component
```tsx
import { getProductTitle, formatPrice } from '@/lib/i18n/ux-texts';
import { UX_TEXTS } from '@/lib/i18n/ux-texts';

const title = getProductTitle(baseProductName);
const priceLabel = UX_TEXTS.priceBreakdown.totalGross;
```

### 2. Update Checkout
```tsx
import { UX_TEXTS } from '@/lib/i18n/ux-texts';

<p>{UX_TEXTS.checkout.confirmationText}</p>
<p>{UX_TEXTS.checkout.productionTime}</p>
<p>{UX_TEXTS.checkout.customizationNotice}</p>
```

### 3. Generate Invoice
```tsx
import { generateInvoice, formatInvoiceText } from '@/lib/invoice/invoice-generator';

const invoice = generateInvoice({ orderId, orderNumber, lineItems, customer });
const invoiceText = formatInvoiceText(invoice);
```

### 4. Email Template
```tsx
import { UX_TEXTS } from '@/lib/i18n/ux-texts';

const subject = UX_TEXTS.orderConfirmation.subject;
const message = UX_TEXTS.orderConfirmation.message;
```

---

## 🚀 Deployment Notes

### Environment
- Production pricebook version: `v1.2026-01-03`
- Currency: EUR
- VAT rate: 19% (German standard)
- Language: German (de-DE)

### Monitoring
- Track revenue by category (accounting breakdown)
- Monitor price validation failures
- Log pricebook version mismatches

### Updates
When changing prices:
1. Update `pricing.config.ts`
2. Increment version (e.g., `v1.2026-02-01`)
3. Test validation with old/new versions
4. Deploy with feature flag (if needed)

---

## ✅ Phase 3 Deliverables

1. ✅ **lib/pricing/pricing.config.ts** – Concrete pricing matrix
2. ✅ **lib/i18n/ux-texts.ts** – German UX text strings
3. ✅ **lib/invoice/invoice-generator.ts** – Legal invoice structure
4. ✅ **docs/EXAMPLE-ORDER-INVOICE-PHASE3.json** – Complete example
5. ✅ **docs/PHASE3-PRICING-UX-INVOICE.md** – This documentation

---

## 📋 Next Steps

### Phase 4 (Future)
- [ ] Cart UI updates with UX_TEXTS
- [ ] Checkout flow with confirmation texts
- [ ] Email templates (order confirmation, shipping)
- [ ] Admin panel invoice generation
- [ ] Accounting system integration (revenue split)
- [ ] PDF invoice generation
- [ ] Multi-language support (EN, FR)

### Integration Testing
- [ ] End-to-end checkout flow
- [ ] Price calculation validation
- [ ] Invoice PDF generation
- [ ] Email delivery
- [ ] Accounting export

---

**Phase 3 Complete** ✅  
All pricing, UX texts, and invoice structures finalized.
