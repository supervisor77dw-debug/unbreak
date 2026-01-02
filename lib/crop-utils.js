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
  if (!crop || !isFiniteNumber(crop.scale) || crop.scale <= 0) {
    console.log('[isValidCropState] V2-ENABLED: Failed basic checks', { crop, hasScale: !!crop?.scale, scaleFinite: isFiniteNumber(crop?.scale), scalePositive: crop?.scale > 0 });
    return false;
  }
  
  // V2: Check nx/ny if cropVersion=2
  if (crop.cropVersion === 2) {
    const valid = isFiniteNumber(crop.nx) && isFiniteNumber(crop.ny);
    console.log('[isValidCropState] V2-ENABLED: Checking V2 format', { nx: crop.nx, ny: crop.ny, nxFinite: isFiniteNumber(crop.nx), nyFinite: isFiniteNumber(crop.ny), valid });
    return valid;
  }
  
  // V1: Check x/y (legacy)
  const valid = isFiniteNumber(crop.x) && isFiniteNumber(crop.y);
  console.log('[isValidCropState] V2-ENABLED: Checking V1 format', { x: crop.x, y: crop.y, xFinite: isFiniteNumber(crop.x), yFinite: isFiniteNumber(crop.y), valid });
  return valid;
}

/**
 * Sanitize Crop-State: ersetzt NaN/Infinity/null durch Safe Defaults
 * Supports both V1 (x/y) and V2 (nx/ny) formats
 */
export function sanitizeCropState(crop) {
  const scale = isFiniteNumber(crop?.scale) && crop.scale > 0 ? crop.scale : 1.0;
  const cropVersion = crop?.cropVersion || 1;
  
  if (cropVersion === 2) {
    // V2: Normalized offsets
    const nx = isFiniteNumber(crop?.nx) ? crop.nx : 0;
    const ny = isFiniteNumber(crop?.ny) ? crop.ny : 0;
    return { scale, nx, ny, cropVersion: 2, x: 0, y: 0 };
  }
  
  // V1: Legacy pixel offsets
  const x = isFiniteNumber(crop?.x) ? crop.x : 0;
  const y = isFiniteNumber(crop?.y) ? crop.y : 0;
  return { scale, x, y, cropVersion: 1 };
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
 * ONE CROP RECT TO RULE THEM ALL
 * 
 * Berechnet CropRect EINMAL im Original-Pixel-Space.
 * Shop und Thumb MÜSSEN diesen identischen Rect nutzen!
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * KOORDINATENRAUM-DEFINITION (VERBINDLICH - Option A):
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * x/y werden IMMER in 900×1125 REFERENCE SPACE gespeichert und interpretiert.
 * 
 * - Reference Space: Virtueller 900×1125 Frame (4:5 aspect, Shop-Größe)
 * - x=0, y=0: Center des Reference Frame
 * - x=+100: 100px nach rechts vom Center (im 900×1125 Raum)
 * - y=+100: 100px nach unten vom Center (im 900×1125 Raum)
 * 
 * WICHTIG für UI-Integration:
 * - Editor-Container kann beliebige Größe haben (z.B. 400×500 im Browser)
 * - Drag-Deltas MÜSSEN vom Container-Raum in Reference-Raum umgerechnet werden:
 *   dx_ref = dx_container * (900 / containerWidth)
 *   dy_ref = dy_container * (1125 / containerHeight)
 * 
 * WICHTIG für Server-Pipeline:
 * - x/y sind bereits in Reference-Space → direkt nutzbar
 * - Müssen nur in Original-Pixel-Space gemappt werden (via refToOrigScale)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * TRANSFORM ORDER (für Pixel-Perfect Match):
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. EXIF normalize → orientation = 1, get origW/origH
 * 2. Calculate base 4:5 rect that covers original (cover-fit)
 * 3. Apply zoom: scale > 1.0 → rect gets SMALLER (zoom in)
 * 4. Map x/y from 900×1125 reference to original pixels
 * 5. Apply offsets to centered rect
 * 6. Clamp to bounds
 */

// Reference space constants (900×1125 = 4:5 shop size)
const REFERENCE_W = 900;
const REFERENCE_H = 1125;

/**
 * Compute crop rectangle in original pixels (SINGLE SOURCE OF TRUTH - V2)
 * 
 * NEW: Uses normalized offsets (nx/ny) instead of reference-space pixels
 * Server does NOT depend on viewport/reference sizes
 * 
 * @param {number} origW - Original image width (after EXIF rotation)
 * @param {number} origH - Original image height (after EXIF rotation)
 * @param {number} targetAspect - Target aspect ratio (width/height) - ALWAYS 0.8 for 4:5
 * @param {number} scale - User crop scale (1.0 - 2.5)
 * @param {number} nx - Normalized X offset (0.0 to 1.0, relative to cropW)
 * @param {number} ny - Normalized Y offset (0.0 to 1.0, relative to cropH)
 * @param {number} cropVersion - Version tag (1=legacy x/y, 2=normalized nx/ny)
 * @returns {Object} { left, top, width, height, debug } in ORIGINAL pixels
 */
export function computeCropRectOriginalPx(
  origW, 
  origH, 
  targetAspect = 0.8, 
  scale = 1.0, 
  nx = 0,  // NEW: normalized offset
  ny = 0,  // NEW: normalized offset
  cropVersion = 2,  // NEW: version tag
  legacyX = 0,  // DEPRECATED: for migration only
  legacyY = 0   // DEPRECATED: for migration only
) {
  // GUARD: Validate inputs
  if (!isFiniteNumber(origW) || !isFiniteNumber(origH) || origW <= 0 || origH <= 0) {
    console.warn('[computeCropRectOriginalPx] Invalid original size', { origW, origH });
    return { left: 0, top: 0, width: Math.round(origW), height: Math.round(origH), debug: {} };
  }
  
  if (!isFiniteNumber(targetAspect) || targetAspect <= 0) {
    console.warn('[computeCropRectOriginalPx] Invalid aspect ratio', { targetAspect });
    targetAspect = 0.8; // 4:5 fallback
  }
  
  // STEP 1: Base crop box (cover-fit 4:5 in original pixels)
  let baseW = origW;
  let baseH = origH;
  
  if (origW / origH > targetAspect) {
    // Too wide → crop width, preserve height
    baseW = Math.round(origH * targetAspect);
    baseH = origH;
  } else {
    // Too tall → crop height, preserve width
    baseW = origW;
    baseH = Math.round(origW / targetAspect);
  }
  
  // STEP 2: Apply zoom on base box
  const safeScale = isFiniteNumber(scale) && scale > 0 ? scale : 1.0;
  const cropW = Math.round(baseW / safeScale);
  const cropH = Math.round(baseH / safeScale);
  
  // STEP 3: Apply normalized offsets
  // MIGRATION: If cropVersion=1 or nx/ny are missing, use legacy x/y mapping
  let offsetX, offsetY, offsetSource;
  
  if (cropVersion === 2 && isFiniteNumber(nx) && isFiniteNumber(ny)) {
    // V2: Normalized offsets (CORRECT WAY)
    // nx/ny are relative to cropW/cropH (0.0 = centered, ±0.5 = max shift)
    offsetX = nx * cropW;
    offsetY = ny * cropH;
    offsetSource = 'nx/ny';
  } else if (isFiniteNumber(legacyX) || isFiniteNumber(legacyY)) {
    // V1: Legacy reference-space mapping (DEPRECATED)
    const pxPerRefX = baseW / REFERENCE_W;
    const pxPerRefY = baseH / REFERENCE_H;
    offsetX = ((legacyX || 0) * pxPerRefX) / safeScale;
    offsetY = ((legacyY || 0) * pxPerRefY) / safeScale;
    offsetSource = 'legacy x/y';
    console.warn('[computeCropRectOriginalPx] Using DEPRECATED x/y mapping. Migrate to nx/ny!', {
      legacyX, legacyY, offsetX, offsetY
    });
  } else {
    // No offsets provided
    offsetX = 0;
    offsetY = 0;
    offsetSource = 'none (centered)';
  }
  
  // STEP 4: Center-based placement
  const centerX = origW / 2;
  const centerY = origH / 2;
  
  const left = Math.round(centerX - cropW / 2 + offsetX);
  const top = Math.round(centerY - cropH / 2 + offsetY);
  
  // STEP 5: Clamp to bounds
  const clampedLeft = Math.max(0, Math.min(left, origW - cropW));
  const clampedTop = Math.max(0, Math.min(top, origH - cropH));
  const clampedWidth = Math.max(1, Math.min(cropW, origW - clampedLeft));
  const clampedHeight = Math.max(1, Math.min(cropH, origH - clampedTop));
  
  const wasClamped = clampedLeft !== left || clampedTop !== top || 
                     clampedWidth !== cropW || clampedHeight !== cropH;
  
  return {
    left: clampedLeft,
    top: clampedTop,
    width: clampedWidth,
    height: clampedHeight,
    debug: {
      cropVersion,
      offsetSource,
      origSize: `${origW}×${origH}`,
      targetAspect: targetAspect.toFixed(4),
      baseSize: `${baseW}×${baseH}`,
      scale: safeScale.toFixed(2),
      cropSize: `${cropW}×${cropH}`,
      normalizedOffsets: cropVersion === 2 ? `nx=${nx.toFixed(4)}, ny=${ny.toFixed(4)}` : 'N/A (legacy)',
      offsetPixels: `(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`,
      offsetFormula: cropVersion === 2 
        ? `offsetX=${nx.toFixed(4)}*${cropW}=${offsetX.toFixed(2)}`
        : `LEGACY: x=${legacyX}*(${baseW}/${REFERENCE_W})/${safeScale}=${offsetX.toFixed(2)}`,
      position: `left=${left}, top=${top}`,
      positionClamped: `left=${clampedLeft}, top=${clampedTop}`,
      wasClamped,
      hash: `${clampedLeft}_${clampedTop}_${clampedWidth}_${clampedHeight}`,
    }
  };
}

/**
 * SINGLE SOURCE OF TRUTH: Berechnet Transform für 4:5 Crop (STABLE EDITOR VERSION)
 * 
 * Diese Funktion ist für EDITOR-INTERAKTION optimiert:
 * - Pan/Zoom funktioniert intuitiv (drag right = bild right)
 * - Keine Sprünge beim Reload
 * - x/y sind Offsets in Frame-Pixeln vom Center
 * 
 * @param {Object} params
 * @param {number} params.imgW - naturalWidth des Bildes
 * @param {number} params.imgH - naturalHeight des Bildes
 * @param {number} params.frameW - Zielrahmen Breite (z.B. 400px)
 * @param {number} params.frameH - Zielrahmen Höhe (z.B. 500px für 4:5)
 * @param {number} params.scale - User Crop Scale (1.0 - 2.5)
 * @param {number} params.x - User Crop X in Frame-Pixeln (offset from center)
 * @param {number} params.y - User Crop Y in Frame-Pixeln (offset from center)
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
  // Positive x = nach rechts, positive y = nach unten
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
      offset: `(${safeCrop.x}, ${safeCrop.y})`,
      mode: 'stable-editor',
    }
  };
}

/**
 * EXPERIMENTAL: Server-Matching Preview Transform
 * 
 * Versucht die CSS Transform so zu berechnen, dass sie visuell
 * identisch zu Sharp's extract().resize() ist.
 * 
 * WARNUNG: Nicht für Editor-Interaktion geeignet (Pan/Zoom invertiert)!
 * 
 * @param {Object} params - Same as computeCoverTransform
 * @returns {Object} { transform, baseScale, effectiveScale, cropRect }
 */
export function computeServerMatchingTransform({ imgW, imgH, frameW, frameH, scale = 1.0, x = 0, y = 0 }) {
  // GUARD: Validate inputs
  if (!isFiniteNumber(imgW) || !isFiniteNumber(imgH) || imgW <= 0 || imgH <= 0) {
    console.warn('[computeServerMatchingTransform] Invalid image size', { imgW, imgH });
    return { transform: 'none', baseScale: 1, effectiveScale: 1 };
  }
  
  if (!isFiniteNumber(frameW) || !isFiniteNumber(frameH) || frameW <= 0 || frameH <= 0) {
    console.warn('[computeServerMatchingTransform] Invalid frame size', { frameW, frameH });
    return { transform: 'none', baseScale: 1, effectiveScale: 1 };
  }
  
  // Sanitize crop params
  const safeCrop = sanitizeCropState({ scale, x, y });
  
  // STEP 1: Get the cropRect that server would use (in original pixels)
  const cropRect = computeCropRectOriginalPx(imgW, imgH, 0.8, safeCrop.scale, safeCrop.x, safeCrop.y);
  
  // STEP 2: Calculate how to display the cropped portion in the frame
  // The cropped image (cropRect.width × cropRect.height) must fill the frame
  
  // Scale to fill frame (cover-fit the cropped portion)
  const scaleToFillWidth = frameW / cropRect.width;
  const scaleToFillHeight = frameH / cropRect.height;
  const fillScale = Math.max(scaleToFillWidth, scaleToFillHeight);
  
  // STEP 3: Calculate positioning
  // We need to position the ORIGINAL image such that the cropRect appears centered and scaled
  
  // Position of cropRect center in original image
  const cropCenterX = cropRect.left + cropRect.width / 2;
  const cropCenterY = cropRect.top + cropRect.height / 2;
  
  // In CSS, we want this point to be at frame center
  // With scale = fillScale, offset = -(cropCenter * fillScale - frameCenter)
  const offsetX = -(cropCenterX * fillScale - frameW / 2);
  const offsetY = -(cropCenterY * fillScale - frameH / 2);
  
  // CSS Transform: scale the image, then translate to position cropRect center at frame center
  const transform = `scale(${fillScale}) translate(${offsetX / fillScale}px, ${offsetY / fillScale}px)`;
  
  return { 
    transform, 
    baseScale: fillScale, 
    effectiveScale: fillScale,
    cropRect,
    // Debug-Info
    debug: {
      imgSize: `${imgW}x${imgH}`,
      frameSize: `${frameW}x${frameH}`,
      cropRect: `[${cropRect.left}, ${cropRect.top}, ${cropRect.width}, ${cropRect.height}]`,
      fillScale: fillScale.toFixed(4),
      offset: `(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`,
      cropRectHash: cropRect.debug.hash,
      mode: 'server-matching',
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
