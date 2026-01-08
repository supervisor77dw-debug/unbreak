/**
 * UNBREAK ONE - Currency Helpers
 * Admin UI arbeitet in EURO (Komma, 2 Nachkommastellen)
 * DB/Backend arbeiten in CENTS (Integer)
 */

/**
 * Konvertiert Euro-String zu Cents (Integer)
 * @param {string} euroString - z.B. "2,50" oder "2.50"
 * @returns {number} - z.B. 250
 */
export function parseEuroToCents(euroString) {
  if (!euroString || euroString === '') return 0;
  
  // Akzeptiere sowohl Komma als auch Punkt
  const normalized = String(euroString).replace(',', '.');
  const euros = parseFloat(normalized);
  
  if (isNaN(euros) || euros < 0) return 0;
  
  return Math.round(euros * 100);
}

/**
 * Konvertiert Cents zu Euro-String (de-DE Format)
 * @param {number} cents - z.B. 250
 * @returns {string} - z.B. "2,50"
 */
export function formatCentsToEuro(cents) {
  if (typeof cents !== 'number' || isNaN(cents)) return '0,00';
  
  const euros = cents / 100;
  return euros.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Konvertiert Cents zu Euro-String mit € Symbol
 * @param {number} cents - z.B. 250
 * @returns {string} - z.B. "2,50 €"
 */
export function formatCentsToEuroWithSymbol(cents) {
  return `${formatCentsToEuro(cents)} €`;
}
