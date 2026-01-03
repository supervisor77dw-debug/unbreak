/**
 * Invoice Generator - Configurator Design
 * 
 * Generates legally compliant German invoice representation.
 * 
 * Requirements:
 * - VAT applied to total (not per line)
 * - No internal SKUs/keys visible
 * - Clear price breakdown
 * - Accounting-safe revenue mapping
 */

import { PRICING_CONFIG, formatPrice, calculateGross } from '../pricing/pricing.config';
import { UX_TEXTS, getInvoiceLineTitle } from '../i18n/ux-texts';

/**
 * Invoice Line Item Structure
 */
export interface InvoiceLineItem {
  position: number;
  title: string;
  description?: string;
  quantity: number;
  unitPriceNet: number;
  lineTotalNet: number;
  vatRate: number;
  lineTotalGross: number;
  
  // Optional breakdown (not shown on invoice, internal only)
  breakdown?: {
    baseProduct?: { sku: string; priceNet: number };
    customization?: { feeKey: string; priceNet: number };
    premiumAddons?: Array<{ addonKey: string; priceNet: number; label: string }>;
  };
  
  // Metadata
  type: 'CONFIGURATOR_DESIGN' | 'STANDARD_PRODUCT';
  designId?: string;
}

/**
 * Invoice Document Structure
 */
export interface Invoice {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  orderDate: string;
  
  customer: {
    name: string;
    email: string;
    address: {
      street: string;
      postalCode: string;
      city: string;
      country: string;
    };
  };
  
  lineItems: InvoiceLineItem[];
  
  totals: {
    subtotalNet: number;
    vatAmount: number;
    totalGross: number;
    currency: string;
  };
  
  notes: string[];
  
  // Internal accounting mapping (not on invoice)
  _accounting?: {
    revenueByCategory: {
      baseProducts: number;
      customizationServices: number;
      premiumComponents: number;
    };
  };
}

/**
 * Generate invoice line item from configurator cart item
 */
export function generateInvoiceLineItem(
  cartItem: any,
  position: number
): InvoiceLineItem {
  const { payload, pricing } = cartItem;
  
  // Get base product name
  const baseProductName = getBaseProductName(payload.productFamily);
  
  // Calculate totals
  const unitPriceNet = pricing.total;
  const lineTotalNet = unitPriceNet * cartItem.quantity;
  const vatRate = PRICING_CONFIG.vatRate;
  const lineTotalGross = calculateGross(lineTotalNet, vatRate);
  
  // Build breakdown for internal use
  const breakdown = {
    baseProduct: pricing.breakdownLines.find((l: any) => l.type === 'base')
      ? {
          sku: pricing.breakdownLines.find((l: any) => l.type === 'base').sku,
          priceNet: pricing.breakdownLines.find((l: any) => l.type === 'base').lineTotal
        }
      : undefined,
    
    customization: pricing.breakdownLines.find((l: any) => l.type === 'customization')
      ? {
          feeKey: pricing.breakdownLines.find((l: any) => l.type === 'customization').feeKey,
          priceNet: pricing.breakdownLines.find((l: any) => l.type === 'customization').lineTotal
        }
      : undefined,
    
    premiumAddons: pricing.breakdownLines
      .filter((l: any) => l.type === 'addon')
      .map((addon: any) => ({
        addonKey: addon.pricingKey,
        priceNet: addon.lineTotal,
        label: addon.label
      }))
  };
  
  return {
    position,
    title: getInvoiceLineTitle(baseProductName),
    description: UX_TEXTS.shortDescription.withCustomization,
    quantity: cartItem.quantity,
    unitPriceNet,
    lineTotalNet,
    vatRate,
    lineTotalGross,
    breakdown,
    type: 'CONFIGURATOR_DESIGN',
    designId: payload.designId
  };
}

/**
 * Generate complete invoice
 */
export function generateInvoice(
  order: any,
  invoiceNumber: string
): Invoice {
  const lineItems: InvoiceLineItem[] = order.lineItems
    .filter((item: any) => item.type === 'CONFIGURATOR_DESIGN')
    .map((item: any, index: number) => generateInvoiceLineItem(item, index + 1));
  
  // Calculate totals
  const subtotalNet = lineItems.reduce((sum, item) => sum + item.lineTotalNet, 0);
  const vatAmount = lineItems.reduce((sum, item) => sum + (item.lineTotalGross - item.lineTotalNet), 0);
  const totalGross = lineItems.reduce((sum, item) => sum + item.lineTotalGross, 0);
  
  // Calculate accounting breakdown
  const accounting = calculateAccountingBreakdown(lineItems);
  
  return {
    invoiceNumber,
    invoiceDate: new Date().toISOString().split('T')[0],
    orderNumber: order.orderNumber,
    orderDate: order.createdAt.split('T')[0],
    
    customer: order.customer,
    
    lineItems,
    
    totals: {
      subtotalNet: Math.round(subtotalNet * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
      currency: PRICING_CONFIG.currency
    },
    
    notes: [
      UX_TEXTS.invoice.notes.customProduct,
      UX_TEXTS.invoice.notes.productionTime,
      UX_TEXTS.invoice.notes.noReturn
    ],
    
    _accounting: accounting
  };
}

/**
 * Calculate accounting revenue breakdown
 */
function calculateAccountingBreakdown(lineItems: InvoiceLineItem[]) {
  let baseProducts = 0;
  let customizationServices = 0;
  let premiumComponents = 0;
  
  for (const item of lineItems) {
    if (item.breakdown) {
      if (item.breakdown.baseProduct) {
        baseProducts += item.breakdown.baseProduct.priceNet;
      }
      if (item.breakdown.customization) {
        customizationServices += item.breakdown.customization.priceNet;
      }
      if (item.breakdown.premiumAddons) {
        premiumComponents += item.breakdown.premiumAddons.reduce(
          (sum, addon) => sum + addon.priceNet,
          0
        );
      }
    }
  }
  
  return {
    revenueByCategory: {
      baseProducts: Math.round(baseProducts * 100) / 100,
      customizationServices: Math.round(customizationServices * 100) / 100,
      premiumComponents: Math.round(premiumComponents * 100) / 100
    }
  };
}

/**
 * Format invoice as text (German)
 */
export function formatInvoiceText(invoice: Invoice): string {
  const lines: string[] = [];
  
  // Header
  lines.push('RECHNUNG');
  lines.push('─────────────────────────────────────────');
  lines.push('');
  lines.push(`Rechnungsnummer: ${invoice.invoiceNumber}`);
  lines.push(`Rechnungsdatum: ${invoice.invoiceDate}`);
  lines.push(`Bestellnummer: ${invoice.orderNumber}`);
  lines.push('');
  
  // Customer
  lines.push('Kunde:');
  lines.push(invoice.customer.name);
  lines.push(invoice.customer.address.street);
  lines.push(`${invoice.customer.address.postalCode} ${invoice.customer.address.city}`);
  lines.push('');
  
  // Line Items
  lines.push('Positionen:');
  lines.push('─────────────────────────────────────────');
  
  for (const item of invoice.lineItems) {
    lines.push('');
    lines.push(`${item.position}. ${item.title}`);
    if (item.description) {
      lines.push(`   ${item.description}`);
    }
    
    // Optional: Show breakdown (indented)
    if (item.breakdown) {
      if (item.breakdown.baseProduct) {
        lines.push(`   ${UX_TEXTS.invoice.breakdown.baseProduct}`);
      }
      if (item.breakdown.customization) {
        lines.push(`   ${UX_TEXTS.invoice.breakdown.customization}`);
      }
      if (item.breakdown.premiumAddons && item.breakdown.premiumAddons.length > 0) {
        const addonLabels = item.breakdown.premiumAddons
          .map(a => a.label)
          .join(', ');
        lines.push(`   ${UX_TEXTS.invoice.breakdown.components}: ${addonLabels}`);
      }
    }
    
    lines.push('');
    lines.push(`   Menge: ${item.quantity}`);
    lines.push(`   Einzelpreis (netto): ${formatPrice(item.unitPriceNet)}`);
    lines.push(`   Gesamt (netto): ${formatPrice(item.lineTotalNet)}`);
  }
  
  lines.push('');
  lines.push('─────────────────────────────────────────');
  
  // Totals
  lines.push('');
  lines.push(`Zwischensumme (netto): ${formatPrice(invoice.totals.subtotalNet)}`);
  lines.push(`MwSt. (19%): ${formatPrice(invoice.totals.vatAmount)}`);
  lines.push('');
  lines.push(`GESAMTBETRAG: ${formatPrice(invoice.totals.totalGross)}`);
  lines.push('');
  
  // Notes
  lines.push('─────────────────────────────────────────');
  lines.push('');
  lines.push('Hinweise:');
  for (const note of invoice.notes) {
    lines.push(`• ${note}`);
  }
  
  return lines.join('\n');
}

/**
 * Helper: Get base product name from product family
 */
function getBaseProductName(productFamily: string): string {
  const names: Record<string, string> = {
    GLASSHOLDER: 'Glashalter',
    BOTTLEHOLDER: 'Flaschenhalter',
    WINEHOLDER: 'Weinglas-Halter',
    GASTRO: 'Gastro Edition'
  };
  
  return names[productFamily] || 'Produkt';
}

/**
 * Export invoice as JSON for storage
 */
export function exportInvoiceJSON(invoice: Invoice): string {
  return JSON.stringify(invoice, null, 2);
}
