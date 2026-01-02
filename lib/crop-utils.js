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
  // x/y sind Offsets vom Center in Frame-Pixeln (UNSCALED!)
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

/**
 * SINGLE SOURCE OF TRUTH: Compute Extract Rectangle for Sharp
 * 
 * This function computes the EXACT same crop rectangle that the UI preview uses.
 * Must be used by server pipeline to ensure pixel-perfect match.
 * 
 * CRITICAL: Transform Order (MUST match UI!)
 * 1. EXIF normalize → orientation = 1, get origW/origH
 * 2. baseScale = cover-fit to target aspect (4:5)
 * 3. X/Y offsets in BASE coordinate space (frameW x frameH)
 * 4. User zoom → effectiveScale = baseScale * userScale
 * 5. Scale offsets → scaledOffsetX = offsetX * effectiveScale
 * 6. Calculate extract rect in resized image space
 * 
 * @param {Object} params
 * @param {number} params.origW - Original image width (after EXIF rotation)
 * @param {number} params.origH - Original image height (after EXIF rotation)
 * @param {number} params.targetW - Target width (e.g., 900 for shop)
 * @param {number} params.targetH - Target height (e.g., 1125 for shop)
 * @param {number} params.scale - User crop scale (1.0 - 2.5)
 * @param {number} params.x - User crop X offset in base frame pixels
 * @param {number} params.y - User crop Y offset in base frame pixels
 * @returns {Object} { left, top, width, height, debug }
 */
export function computeExtractRect({ origW, origH, targetW, targetH, scale = 1.0, x = 0, y = 0 }) {
  // GUARD: Validate inputs
  if (!isFiniteNumber(origW) || !isFiniteNumber(origH) || origW <= 0 || origH <= 0) {
    console.warn('[computeExtractRect] Invalid original size', { origW, origH });
    return { left: 0, top: 0, width: targetW, height: targetH };
  }
  
  if (!isFiniteNumber(targetW) || !isFiniteNumber(targetH) || targetW <= 0 || targetH <= 0) {
    console.warn('[computeExtractRect] Invalid target size', { targetW, targetH });
    return { left: 0, top: 0, width: targetW, height: targetH };
  }
  
  // Sanitize crop params
  const safeCrop = sanitizeCropState({ scale, x, y });
  
  // 1. baseScale: minimal scale to cover target aspect (4:5)
  const scaleToFillWidth = targetW / origW;
  const scaleToFillHeight = targetH / origH;
  const baseScale = Math.max(scaleToFillWidth, scaleToFillHeight);
  
  // 2. effectiveScale: baseScale * user zoom
  const effectiveScale = baseScale * safeCrop.scale;
  
  // 3. Resize dimensions (what Sharp will resize to)
  const scaledW = Math.round(origW * effectiveScale);
  const scaledH = Math.round(origH * effectiveScale);
  
  // 4. Apply offsets - CRITICAL: Match CSS behavior!
  // CSS: translate(calc(-50% + xpx), ...) applies UNSCALED offset x
  // The offset is in TARGET frame pixels, NOT scaled by effectiveScale
  // 
  // This is because CSS translate() happens in the VISUAL coordinate space,
  // where the frame size = target size (900×1125)
  //
  // Sharp must use the SAME unscaled offsets to match!
  const offsetX = safeCrop.x; // UNSCALED - same as CSS
  const offsetY = safeCrop.y; // UNSCALED - same as CSS
  
  // 5. Calculate extract position (centered + offsets)
  // Center position in resized image
  const centerX = scaledW / 2;
  const centerY = scaledH / 2;
  
  // Extract rect top-left (center - half target size + offset)
  const left = Math.round(centerX - targetW / 2 + offsetX);
  const top = Math.round(centerY - targetH / 2 + offsetY);
  
  // 6. Clamp to ensure we don't exceed bounds
  const clampedLeft = Math.max(0, Math.min(left, scaledW - targetW));
  const clampedTop = Math.max(0, Math.min(top, scaledH - targetH));
  
  return {
    left: clampedLeft,
    top: clampedTop,
    width: targetW,
    height: targetH,
    debug: {
      origSize: `${origW}x${origH}`,
      targetSize: `${targetW}x${targetH}`,
      baseScale: baseScale.toFixed(4),
      userScale: safeCrop.scale.toFixed(2),
      effectiveScale: effectiveScale.toFixed(4),
      resizedSize: `${scaledW}x${scaledH}`,
      offset: `(${safeCrop.x}, ${safeCrop.y})`,
      extractRect: `left=${clampedLeft}, top=${clampedTop}, w=${targetW}, h=${targetH}`,
      wasClamped: clampedLeft !== left || clampedTop !== top,
      note: 'Offsets are UNSCALED (same as CSS translate) - in target frame pixels',
    }
  };
}
