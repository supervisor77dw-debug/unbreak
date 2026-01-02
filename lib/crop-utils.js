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
 * Compute crop rectangle in original pixels (SINGLE SOURCE OF TRUTH)
 * 
 * @param {number} origW - Original image width (after EXIF rotation)
 * @param {number} origH - Original image height (after EXIF rotation)
 * @param {number} targetAspect - Target aspect ratio (width/height) - ALWAYS 0.8 for 4:5
 * @param {number} scale - User crop scale (1.0 - 2.5)
 * @param {number} x - User crop X offset in 900×1125 REFERENCE pixels
 * @param {number} y - User crop Y offset in 900×1125 REFERENCE pixels
 * @returns {Object} { left, top, width, height } in ORIGINAL pixels
 */
export function computeCropRectOriginalPx(origW, origH, targetAspect = 0.8, scale = 1.0, x = 0, y = 0) {
  // GUARD: Validate inputs
  if (!isFiniteNumber(origW) || !isFiniteNumber(origH) || origW <= 0 || origH <= 0) {
    console.warn('[computeCropRectOriginalPx] Invalid original size', { origW, origH });
    // Return full image as fallback
    return { left: 0, top: 0, width: origW, height: origH };
  }
  
  if (!isFiniteNumber(targetAspect) || targetAspect <= 0) {
    console.warn('[computeCropRectOriginalPx] Invalid aspect ratio', { targetAspect });
    targetAspect = 0.8; // 4:5 fallback
  }
  
  // Sanitize crop params
  const safeCrop = sanitizeCropState({ scale, x, y });
  
  // STEP 1: Base crop box (cover-fit 4:5 in original pixels)
  // This is the crop box at scale=1.0 (no zoom)
  // For 1920×1440: baseW=1152, baseH=1440 (width cropped, height preserved)
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
  
  // STEP 2: Apply user zoom on base box
  // Zoom ONLY affects the base box, not the original dimensions
  // scale=1.7 → cropW = baseW / 1.7 (rect gets SMALLER = zoom in)
  const cropW = Math.round(baseW / safeCrop.scale);
  const cropH = Math.round(baseH / safeCrop.scale);
  
  // STEP 3: Map offsets from Reference Space (900×1125 UI preview) to original pixels
  // CRITICAL: x/y are in 900×1125 reference space, NOT in base or original pixels!
  // 
  // Mapping formula:
  // 1. Convert reference pixels to base pixels: x * (baseW / REF_W)
  // 2. Scale by zoom factor: / userScale (zoom in = smaller crop = weaker offset)
  //
  // Example: 1920×1440 → baseW=1152, x=-106, scale=1.8
  //   pxPerRefX = 1152 / 900 = 1.28
  //   offsetXOrig = (-106 * 1.28) / 1.8 ≈ -75 px
  const pxPerRefX = baseW / REFERENCE_W;
  const pxPerRefY = baseH / REFERENCE_H;
  
  const offsetXOrig = (safeCrop.x * pxPerRefX) / safeCrop.scale;
  const offsetYOrig = (safeCrop.y * pxPerRefY) / safeCrop.scale;
  
  // STEP 4: Calculate extract position in original pixels
  // Center the crop rect in original image, then apply offset
  const left = Math.round((origW - cropW) / 2 + offsetXOrig);
  const top = Math.round((origH - cropH) / 2 + offsetYOrig);
  
  // STEP 5: Clamp to original bounds
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
      // Original & Target
      origSize: `${origW}×${origH}`,
      targetAspect: targetAspect.toFixed(4),
      
      // Reference Space (UI preview coordinates)
      refSpace: `${REFERENCE_W}×${REFERENCE_H}`,
      offsetRef: `(${safeCrop.x}, ${safeCrop.y})`,
      
      // Base Crop Box (4:5 cover-fit at scale=1.0)
      baseSize: `${baseW}×${baseH}`,
      pxPerRef: `X=${pxPerRefX.toFixed(4)}, Y=${pxPerRefY.toFixed(4)}`,
      
      // User Zoom
      userScale: safeCrop.scale.toFixed(2),
      cropSize: `${cropW}×${cropH}`,
      
      // Offset Mapping (ref → original pixels)
      offsetOrig: `(${offsetXOrig.toFixed(2)}, ${offsetYOrig.toFixed(2)})`,
      offsetFormula: `x*${pxPerRefX.toFixed(2)}/${safeCrop.scale} = ${safeCrop.x}*${pxPerRefX.toFixed(2)}/${safeCrop.scale} = ${offsetXOrig.toFixed(2)}`,
      
      // Final Crop Rect
      position: `left=${left}, top=${top}`,
      cropRect: `[${clampedLeft}, ${clampedTop}, ${clampedWidth}, ${clampedHeight}]`,
      wasClamped,
      hash: `${clampedLeft}_${clampedTop}_${clampedWidth}_${clampedHeight}`,
      
      // Invariants
      invariants: {
        test1: `scale=1 → cropW=${baseW}, cropH=${baseH}`,
        test2: `scale=${safeCrop.scale} → cropW≈${Math.round(baseW/safeCrop.scale)}, cropH≈${Math.round(baseH/safeCrop.scale)}`,
        offsetTest: `pxPerRef must be proportional to baseW/${REFERENCE_W}=${pxPerRefX.toFixed(4)}`,
      }
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
