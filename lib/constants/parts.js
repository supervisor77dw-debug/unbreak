/**
 * UNBREAK ONE - Bauteil-Definitionen (Single Source of Truth)
 * Deutsche Labels für alle Bauteile - überall konsistent verwenden
 */

export const PART_LABELS = {
  base: 'Grundplatte',
  arm: 'Arm',
  module: 'Adapter',
  pattern: 'Muster',
  finish: 'Finish',
};

// Reihenfolge für UI-Darstellung
export const PART_ORDER = ['base', 'arm', 'module', 'pattern', 'finish'];

export function getPartLabel(partKey) {
  return PART_LABELS[partKey] || partKey;
}
