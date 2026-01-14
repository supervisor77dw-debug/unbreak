/**
 * =====================================================
 * 🔥 MESSE-FIX: Price Calculator (Netto/MwSt/Brutto)
 * =====================================================
 * Ensures NETTO + MWST = BRUTTO consistency
 * Rule: Brutto is authoritative (B2C), but we show breakdown
 * =====================================================
 */

const VAT_RATE_DE = 0.19; // 19% Standard-MwSt Deutschland

/**
 * Calculate Netto and MwSt from Brutto (reverse calculation)
 * Ensures: netto + vat = brutto (cent-exact)
 * 
 * @param {number} bruttoCents - Total gross amount in cents
 * @param {number} vatRate - VAT rate (default 0.19 for Germany)
 * @returns {object} { netto, vat, brutto }
 */
export function calculateNettoFromBrutto(bruttoCents, vatRate = VAT_RATE_DE) {
  if (!bruttoCents || bruttoCents === 0) {
    return { netto: 0, vat: 0, brutto: 0 };
  }

  // Reverse calculation: brutto / (1 + VAT) = netto
  const netto = Math.round(bruttoCents / (1 + vatRate));
  const vat = bruttoCents - netto; // Ensure cent-exact: vat = brutto - netto

  return {
    netto,
    vat,
    brutto: bruttoCents,
  };
}

/**
 * Extract pricing breakdown from order
 * Priority: 1) Snapshot values, 2) Calculate from total
 * 
 * @param {object} order - Order object from API
 * @returns {object} Pricing breakdown with netto, vat, shipping, brutto
 */
export function getPricingBreakdown(order) {
  // Try to get snapshot
  const snapshot = order.price_breakdown_json || order.priceBreakdownJson || order.metadata?.pricing_snapshot;

  // CASE 1: Snapshot with full breakdown
  if (snapshot && snapshot.grand_total_cents) {
    return {
      hasSnapshot: true,
      subtotalNetto: snapshot.subtotal_net_cents || calculateNettoFromBrutto(snapshot.subtotal_cents || 0).netto,
      subtotalVat: snapshot.subtotal_vat_cents || calculateNettoFromBrutto(snapshot.subtotal_cents || 0).vat,
      subtotalBrutto: snapshot.subtotal_cents || 0,
      
      shippingNetto: snapshot.shipping_net_cents || calculateNettoFromBrutto(snapshot.shipping_cents || 0).netto,
      shippingVat: snapshot.shipping_vat_cents || calculateNettoFromBrutto(snapshot.shipping_cents || 0).vat,
      shippingBrutto: snapshot.shipping_cents || 0,
      
      totalNetto: snapshot.total_net_cents || calculateNettoFromBrutto(snapshot.grand_total_cents).netto,
      totalVat: snapshot.tax_cents || snapshot.total_vat_cents || calculateNettoFromBrutto(snapshot.grand_total_cents).vat,
      totalBrutto: snapshot.grand_total_cents,
      
      currency: snapshot.currency || order.currency || 'EUR',
      vatRate: snapshot.vat_rate || VAT_RATE_DE,
    };
  }

  // CASE 2: No snapshot, calculate from total_amount_cents
  const brutto = order.total_amount_cents || order.totalGross || order.amountTotal || 0;
  
  if (brutto > 0) {
    const { netto, vat } = calculateNettoFromBrutto(brutto);
    
    return {
      hasSnapshot: false,
      subtotalNetto: netto,
      subtotalVat: vat,
      subtotalBrutto: brutto,
      
      shippingNetto: 0,
      shippingVat: 0,
      shippingBrutto: 0,
      
      totalNetto: netto,
      totalVat: vat,
      totalBrutto: brutto,
      
      currency: order.currency || 'EUR',
      vatRate: VAT_RATE_DE,
    };
  }

  // CASE 3: No data available
  return {
    hasSnapshot: false,
    subtotalNetto: 0,
    subtotalVat: 0,
    subtotalBrutto: 0,
    shippingNetto: 0,
    shippingVat: 0,
    shippingBrutto: 0,
    totalNetto: 0,
    totalVat: 0,
    totalBrutto: 0,
    currency: order.currency || 'EUR',
    vatRate: VAT_RATE_DE,
  };
}

/**
 * Format cents as currency string
 * @param {number} cents 
 * @param {string} currency 
 * @returns {string}
 */
export function formatCurrency(cents, currency = 'EUR') {
  if (cents == null || isNaN(cents)) return '€0,00';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
}

/**
 * Verify pricing consistency (for debugging)
 * Returns warnings if netto + vat != brutto
 */
export function verifyPricingConsistency(breakdown) {
  const warnings = [];

  // Check subtotal
  const subtotalSum = breakdown.subtotalNetto + breakdown.subtotalVat;
  if (Math.abs(subtotalSum - breakdown.subtotalBrutto) > 1) { // Allow 1 cent diff for rounding
    warnings.push(`Subtotal inconsistent: ${breakdown.subtotalNetto} + ${breakdown.subtotalVat} != ${breakdown.subtotalBrutto}`);
  }

  // Check shipping
  if (breakdown.shippingBrutto > 0) {
    const shippingSum = breakdown.shippingNetto + breakdown.shippingVat;
    if (Math.abs(shippingSum - breakdown.shippingBrutto) > 1) {
      warnings.push(`Shipping inconsistent: ${breakdown.shippingNetto} + ${breakdown.shippingVat} != ${breakdown.shippingBrutto}`);
    }
  }

  // Check total
  const totalSum = breakdown.totalNetto + breakdown.totalVat;
  if (Math.abs(totalSum - breakdown.totalBrutto) > 1) {
    warnings.push(`Total inconsistent: ${breakdown.totalNetto} + ${breakdown.totalVat} != ${breakdown.totalBrutto}`);
  }

  return warnings;
}
