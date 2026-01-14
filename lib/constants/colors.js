/**
 * UNBREAK ONE - Configurator Color Definitions
 * Single Source of Truth für alle 7 verfügbaren Farben
 * FINAL: Diese Keys stammen AUSSCHLIESSLICH aus dem Konfigurator
 */

export const CONFIGURATOR_COLORS = [
  { id: 'mint', name: 'Mint', hex: '#4f9f8f' },
  { id: 'green', name: 'Grün', hex: '#2d5f4f' },
  { id: 'purple', name: 'Lila', hex: '#6b4f9f' },
  { id: 'ice_blue', name: 'Eisblau', hex: '#4f8f9f' },
  { id: 'dark_blue', name: 'Dunkelblau', hex: '#2d4f6f' },
  { id: 'red', name: 'Rot', hex: '#9f4f4f' },
  { id: 'black', name: 'Schwarz', hex: '#1a1a1a' },
];

/**
 * ADAPTER ALLOWED COLORS (MODULE PART ONLY)
 * Adapter ist NUR in 5 Farben verfügbar:
 * - rot (red)
 * - schwarz (black) 
 * - blau (dark_blue)
 * - grün (green)
 * - grau (mint - wird als 'Grau' gelabelt für Adapter)
 */
export const ADAPTER_ALLOWED_COLORS = [
  { id: 'red', name: 'Rot', hex: '#9f4f4f' },
  { id: 'black', name: 'Schwarz', hex: '#1a1a1a' },
  { id: 'dark_blue', name: 'Blau', hex: '#2d4f6f' },
  { id: 'green', name: 'Grün', hex: '#2d5f4f' },
  { id: 'mint', name: 'Grau', hex: '#4f9f8f' }, // Adapter: 'Grau' statt 'Mint'
];

export const ADAPTER_ALLOWED_COLOR_IDS = ADAPTER_ALLOWED_COLORS.map(c => c.id);
export const DEFAULT_ADAPTER_COLOR = 'black'; // Fallback für ungültige Farben

export const CONFIGURATOR_COLOR_IDS = CONFIGURATOR_COLORS.map(c => c.id);

export function getColorName(colorId) {
  const color = CONFIGURATOR_COLORS.find(c => c.id === colorId);
  return color ? color.name : colorId;
}

export function getColorHex(colorId) {
  const color = CONFIGURATOR_COLORS.find(c => c.id === colorId);
  return color ? color.hex : '#888888';
}

// Default pricing: 0 Aufpreis für alle Farben (wird aus DB überschrieben)
export const DEFAULT_COLOR_PRICES = CONFIGURATOR_COLORS.reduce((acc, color) => {
  acc[color.id] = 0;
  return acc;
}, {});
