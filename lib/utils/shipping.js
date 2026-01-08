/**
 * Shipping region utilities for DE/EU/INT classification
 */

const EU_COUNTRIES = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
];

/**
 * Determine shipping region from country code
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'DE', 'FR', 'US')
 * @returns {'DE'|'EU'|'INT'} - Shipping region
 */
export function countryToRegion(countryCode) {
  if (!countryCode) return 'INT'; // Default to international if no country provided
  
  const country = countryCode.toUpperCase();
  
  if (country === 'DE') return 'DE';
  if (EU_COUNTRIES.includes(country)) return 'EU';
  return 'INT';
}

/**
 * Get shipping rate for a region (for reference/validation)
 * @param {'DE'|'EU'|'INT'} region
 * @returns {number} - Price in cents
 */
export function getDefaultShippingForRegion(region) {
  switch (region) {
    case 'DE': return 490;  // 4,90 EUR
    case 'EU': return 1290; // 12,90 EUR
    case 'INT': return 2490; // 24,90 EUR
    default: return 2490;
  }
}

/**
 * Get human-readable region label
 * @param {'DE'|'EU'|'INT'} region
 * @param {'de'|'en'} lang
 * @returns {string}
 */
export function getRegionLabel(region, lang = 'de') {
  const labels = {
    DE: { de: 'Deutschland', en: 'Germany' },
    EU: { de: 'EU-Ausland', en: 'EU Countries' },
    INT: { de: 'International', en: 'International' },
  };
  return labels[region]?.[lang] || region;
}
