/**
 * CROP-UTILS - DETERMINISTISCHES CROP-SYSTEM
 * 
 * KEINE AUTO-ZOOM-HEURISTIKEN!
 * Reine mathematische Crop-Berechnungen für 4:5 Produktbilder
 * 
 * GUARDS GEGEN NaN:
 * - Alle Inputs werden validiert
 * - Alle Outputs werden validiert
 * - Bei Invalid → Safe Defaults (1.0, 0, 0)
 */

// --- GUARDS ---

/**
 * Prüft ob eine Zahl valide und finite ist (NICHT NaN, NICHT Infinity)
 */
export function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Prüft ob Size-Objekt valide ist (width & height > 0 und finite)
 */
export function isValidSize(size) {
  return size 
    && isFiniteNumber(size.width) 
    && isFiniteNumber(size.height)
    && size.width > 0 
    && size.height > 0;
}

/**
 * Prüft ob Crop-State valide ist (scale, x, y alle finite)
 */
export function isValidCropState(crop) {
  return crop
    && isFiniteNumber(crop.scale)
    && isFiniteNumber(crop.x)
    && isFiniteNumber(crop.y)
    && crop.scale > 0;
}

/**
 * Sanitize Crop-State: ersetzt NaN/Infinity/null durch Safe Defaults
 */
export function sanitizeCropState(crop) {
  const scale = isFiniteNumber(crop?.scale) && crop.scale > 0 ? crop.scale : 1.0;
  const x = isFiniteNumber(crop?.x) ? crop.x : 0;
  const y = isFiniteNumber(crop?.y) ? crop.y : 0;
  
  return { scale, x, y };
}

// --- CORE FUNCTIONS ---

/**
 * Berechnet minimales Scale damit Bild Container vollständig füllt (cover-fit)
 * 
 * @param {Object} imageSize - {width, height} in Pixel (naturalWidth/Height)
 * @param {Object} containerSize - {width, height} in Pixel (clientWidth/Height)
 * @returns {number} Minimales Scale (>= 1.0) oder 1.0 falls ungültig
 */
export function calculateCoverScale(imageSize, containerSize) {
  // GUARD: Validate inputs
  if (!isValidSize(imageSize) || !isValidSize(containerSize)) {
    console.warn('[crop-utils] calculateCoverScale: Invalid size', { imageSize, containerSize });
    return 1.0;
  }

  // Scale um width zu füllen vs scale um height zu füllen
  const scaleToFillWidth = containerSize.width / imageSize.width;
  const scaleToFillHeight = containerSize.height / imageSize.height;

  // Nehme das GRÖSSERE (damit beide Dimensionen gefüllt sind)
  const coverScale = Math.max(scaleToFillWidth, scaleToFillHeight);

  // GUARD: Result muss finite sein
  if (!isFiniteNumber(coverScale) || coverScale <= 0) {
    console.warn('[crop-utils] calculateCoverScale: Invalid result', { coverScale, imageSize, containerSize });
    return 1.0;
  }

  return coverScale;
}

/**
 * Clamped Crop-State: garantiert dass Container immer vollständig gefüllt ist
 * 
 * @param {object} crop - { scale, x, y }
 * @param {Object} imageSize - {width, height} natural dimensions
 * @param {Object} containerSize - {width, height} container dimensions
 * @returns {object} { scale, x, y } - geclampt
 */
export function clampCropState(crop, imageSize, containerSize) {
  // GUARD: Sanitize input crop
  const safeCrop = sanitizeCropState(crop);
  
  // GUARD: Validate sizes
  if (!isValidSize(imageSize) || !isValidSize(containerSize)) {
    console.warn('[crop-utils] clampCropState: Invalid size, using defaults', { imageSize, containerSize });
    return safeCrop;
  }

  // Berechne coverScaleMin (minimales Scale um Container zu füllen)
  const coverScaleMin = calculateCoverScale(imageSize, containerSize);
  
  // Scale: zwischen coverScaleMin und 2.5x (max zoom)
  const scale = Math.max(coverScaleMin, Math.min(2.5, safeCrop.scale));
  
  // Berechne maximale x/y Offsets (damit kein leerer Bereich sichtbar wird)
  const scaledWidth = imageSize.width * scale;
  const scaledHeight = imageSize.height * scale;
  
  const maxX = Math.max(0, (scaledWidth - containerSize.width) / 2);
  const maxY = Math.max(0, (scaledHeight - containerSize.height) / 2);
  
  // Clamp x/y
  const x = Math.max(-maxX, Math.min(maxX, safeCrop.x));
  const y = Math.max(-maxY, Math.min(maxY, safeCrop.y));
  
  // GUARD: Final validation
  const result = { scale, x, y };
  if (!isValidCropState(result)) {
    console.error('[crop-utils] clampCropState: INVALID RESULT! Using safe defaults', result);
    return { scale: 1.0, x: 0, y: 0 };
  }
  
  return result;
}

/**
 * Generiert CSS transform string
 * 
 * @param {object} crop - { scale, x, y }
 * @returns {string} CSS transform
 */
export function generateTransform(crop) {
  // GUARD: Sanitize crop
  const safeCrop = sanitizeCropState(crop);
  
  return `translate(calc(-50% + ${safeCrop.x}px), calc(-50% + ${safeCrop.y}px)) scale(${safeCrop.scale})`;
}

/**
 * Default Crop für neues Bild (zentriert, minimal gefüllt)
 * 
 * @param {Object} imageSize - {width, height} optional
 * @param {Object} containerSize - {width, height} optional
 * @returns {object} { scale, x, y }
 */
export function getDefaultCrop(imageSize, containerSize) {
  // Wenn Sizes verfügbar: berechne coverScaleMin
  if (isValidSize(imageSize) && isValidSize(containerSize)) {
    const coverScaleMin = calculateCoverScale(imageSize, containerSize);
    return { scale: coverScaleMin, x: 0, y: 0 };
  }
  
  // Fallback: Safe Defaults
  return { scale: 1.0, x: 0, y: 0 };
}

/**
 * SINGLE SOURCE OF TRUTH: Berechnet Transform für 4:5 Crop
 * 
 * Nutzen für: Editor Preview, Shop Cards, Admin Thumbnails
 * 
 * @param {Object} params
 * @param {number} params.imgW - naturalWidth des Bildes
 * @param {number} params.imgH - naturalHeight des Bildes
 * @param {number} params.frameW - Zielrahmen Breite (z.B. 400px)
 * @param {number} params.frameH - Zielrahmen Höhe (z.B. 500px für 4:5)
 * @param {number} params.scale - User Crop Scale (1.0 - 2.5)
 * @param {number} params.x - User Crop X in Frame-Pixeln
 * @param {number} params.y - User Crop Y in Frame-Pixeln
 * @returns {Object} { transform, baseScale, effectiveScale }
 */
export function computeCoverTransform({ imgW, imgH, frameW, frameH, scale = 1.0, x = 0, y = 0 }) {
  // GUARD: Validate inputs
  if (!isFiniteNumber(imgW) || !isFiniteNumber(imgH) || imgW <= 0 || imgH <= 0) {
    console.warn('[computeCoverTransform] Invalid image size', { imgW, imgH });
    return { transform: 'none', baseScale: 1, effectiveScale: 1 };
  }
  
  if (!isFiniteNumber(frameW) || !isFiniteNumber(frameH) || frameW <= 0 || frameH <= 0) {
    console.warn('[computeCoverTransform] Invalid frame size', { frameW, frameH });
    return { transform: 'none', baseScale: 1, effectiveScale: 1 };
  }
  
  // Sanitize crop params
  const safeCrop = sanitizeCropState({ scale, x, y });
  
  // baseScale: minimales Scale um Frame zu füllen (cover-fit)
  const scaleToFillWidth = frameW / imgW;
  const scaleToFillHeight = frameH / imgH;
  const baseScale = Math.max(scaleToFillWidth, scaleToFillHeight);
  
  // effectiveScale: baseScale * user crop scale
  const effectiveScale = baseScale * safeCrop.scale;
  
  // Transform: translate DANN scale
  // Origin: center center (default für ProductImage)
  // x/y sind Offsets vom Center in Frame-Pixeln
  const transform = `translate(calc(-50% + ${safeCrop.x}px), calc(-50% + ${safeCrop.y}px)) scale(${effectiveScale})`;
  
  return { 
    transform, 
    baseScale, 
    effectiveScale,
    // Debug-Info
    debug: {
      imgSize: `${imgW}x${imgH}`,
      frameSize: `${frameW}x${frameH}`,
      baseScale: baseScale.toFixed(3),
      userScale: safeCrop.scale.toFixed(2),
      effectiveScale: effectiveScale.toFixed(3),
      offset: `(${safeCrop.x}, ${safeCrop.y})`
    }
  };
}

