/**
 * UNBREAK ONE - Configurator Color Definitions
 * Single Source of Truth für alle 7 verfügbaren Farben
 */

export const CONFIGURATOR_COLORS = [
  { id: 'green', name: 'Grün', hex: '#2d5f4f' },
  { id: 'purple', name: 'Lila', hex: '#6b4f9f' },
  { id: 'iceBlue', name: 'Eisblau', hex: '#4f8f9f' },
  { id: 'red', name: 'Rot', hex: '#9f4f4f' },
  { id: 'mint', name: 'Mint', hex: '#4f9f8f' },
  { id: 'yellow', name: 'Gelb', hex: '#9f8f4f' },
  { id: 'orange', name: 'Orange', hex: '#9f6f4f' },
];

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
