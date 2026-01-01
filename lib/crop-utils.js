/**
 * CROP UTILITIES - Deterministisches Crop-System
 * 
 * KEINE AUTO-ZOOM-HEURISTIKEN!
 * Nur mathematische Berechnung der minimalen Scale + Grenzen.
 */

/**
 * Berechnet coverScaleMin: minimaler Scale damit Bild 4:5 Container vollständig füllt
 * 
 * @param {number} imgNaturalWidth - Originale Bildbreite
 * @param {number} imgNaturalHeight - Originale Bildhöhe
 * @param {number} aspectW - Container Aspect Width (z.B. 4)
 * @param {number} aspectH - Container Aspect Height (z.B. 5)
 * @returns {number} Minimaler Scale-Faktor
 */
export function calculateCoverScale(imgNaturalWidth, imgNaturalHeight, aspectW = 4, aspectH = 5) {
  if (!imgNaturalWidth || !imgNaturalHeight) return 1.0;
  
  const imageAspect = imgNaturalWidth / imgNaturalHeight;
  const containerAspect = aspectW / aspectH;
  
  // Wenn Bild breiter ist als Container: scale nach Höhe
  // Wenn Bild schmaler ist als Container: scale nach Breite
  const coverScale = imageAspect > containerAspect 
    ? 1.0  // Bild ist landscape → passt height-wise
    : containerAspect / imageAspect; // Bild ist portrait → muss breiter werden
  
  return Math.max(1.0, coverScale);
}

/**
 * Clamped Crop-State: garantiert dass Container immer vollständig gefüllt ist
 * 
 * @param {object} crop - { scale, x, y }
 * @param {number} imgNaturalWidth
 * @param {number} imgNaturalHeight
 * @param {number} containerWidth - Tatsächliche Container-Breite in px
 * @param {number} containerHeight - Tatsächliche Container-Höhe in px
 * @returns {object} { scale, x, y } - geclampt
 */
export function clampCropState(crop, imgNaturalWidth, imgNaturalHeight, containerWidth, containerHeight) {
  const coverScaleMin = calculateCoverScale(imgNaturalWidth, imgNaturalHeight, 4, 5);
  
  // Scale: zwischen coverScaleMin und 2.5x (max zoom)
  const scale = Math.max(coverScaleMin, Math.min(2.5, crop?.scale || coverScaleMin));
  
  // Berechne maximale x/y Offsets (damit kein leerer Bereich sichtbar wird)
  const scaledWidth = imgNaturalWidth * scale;
  const scaledHeight = imgNaturalHeight * scale;
  
  const maxX = Math.max(0, (scaledWidth - containerWidth) / 2);
  const maxY = Math.max(0, (scaledHeight - containerHeight) / 2);
  
  // Clamp x/y
  const x = Math.max(-maxX, Math.min(maxX, crop?.x || 0));
  const y = Math.max(-maxY, Math.min(maxY, crop?.y || 0));
  
  return { scale, x, y };
}

/**
 * Generiert CSS transform string
 * 
 * @param {number} scale
 * @param {number} x - Offset in px
 * @param {number} y - Offset in px
 * @returns {string} CSS transform
 */
export function generateTransform(scale, x, y) {
  return `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
}

/**
 * Default Crop für neues Bild (zentriert, minimal gefüllt)
 * 
 * @param {number} imgNaturalWidth
 * @param {number} imgNaturalHeight
 * @returns {object} { scale, x, y }
 */
export function getDefaultCrop(imgNaturalWidth, imgNaturalHeight) {
  const coverScale = calculateCoverScale(imgNaturalWidth, imgNaturalHeight, 4, 5);
  return {
    scale: coverScale,
    x: 0,
    y: 0,
  };
}
