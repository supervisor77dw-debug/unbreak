/**
 * ProductImage - SINGLE SOURCE OF TRUTH für alle Produktbilder
 * 
 * DETERMINISTISCHES CROP-SYSTEM (KEINE AUTO-ZOOM-HEURISTIKEN!):
 * - Einheitliches 4:5 Hochformat ÜBERALL
 * - coverScaleMin: mathematisch berechnet (Bild füllt Container vollständig)
 * - scale: coverScaleMin bis 2.5x (User-definiert)
 * - Position x/y: geclampt damit Container immer gefüllt bleibt
 * - Identisch in: Shop Cards, Admin List, Admin Edit Preview
 * 
 * Props:
 * - src: Bild-URL
 * - alt: Alt-Text
 * - crop: { scale: number, x: number, y: number } (default: auto-berechnet via coverScale)
 * - variant: "card" | "adminList" | "admin-editor"
 * - className: Optionale CSS-Klasse
 * - onLoad, onError: Callbacks
 * - interactive: boolean (für Drag im Admin)
 * - onCropChange: (crop) => void (für Drag-Updates)
 */

import { useState, useRef, useEffect } from 'react';
import { 
  calculateCoverScale, 
  clampCropState, 
  generateTransform, 
  getDefaultCrop,
  computeCoverTransform,
  sanitizeCropState,
  isValidSize,
  isValidCropState
} from '../lib/crop-utils';

export default function ProductImage({
  src,
  alt = 'Produktbild',
  crop = { scale: 1.0, x: 0, y: 0 },
  variant = 'card',
  className = '',
  onLoad,
  onError,
  interactive = false,
  onCropChange,
}) {
  // --- STATE ---
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [localCrop, setLocalCrop] = useState(() => sanitizeCropState(crop));
  const [imageSize, setImageSize] = useState(null);
  const [containerSize, setContainerSize] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // --- CROP-PROPS SYNCHRONISIEREN ---
  useEffect(() => {
    const safeCrop = sanitizeCropState(crop);
    setLocalCrop(safeCrop);
    
    // WARN wenn NaN reinkam
    if (!isValidCropState(crop)) {
      console.warn('[ProductImage] Invalid crop prop received, sanitized:', { 
        original: crop, 
        sanitized: safeCrop,
        src: src?.substring(0, 60)
      });
    }
  }, [crop, src]);

  // --- CONTAINER-GRÖßE MESSEN ---
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      // GUARD: Nur messen wenn ref noch existiert
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      
      // GUARD: Nur State setzen wenn rect valid ist
      if (rect && rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    
    // GUARD: ResizeObserver nur wenn ref exists
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      // Callback-Guard: Observer kann nach unmount noch feuern
      if (containerRef.current) {
        updateSize();
      }
    });
    
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // --- BILD-GRÖßE BEIM LADEN MESSEN ---
  const handleImageLoad = (e) => {
    const img = e.target;
    const newSize = {
      width: img.naturalWidth,
      height: img.naturalHeight
    };
    
    setImageSize(newSize);
    setImageLoaded(true);
    
    // DEBUG: Log Image-Load mit coverScaleMin
    if (containerSize && isValidSize(newSize) && isValidSize(containerSize)) {
      const coverScaleMin = calculateCoverScale(newSize, containerSize);
      console.log('[ProductImage] Image loaded:', {
        variant,
        src: src?.substring(0, 60),
        naturalW: newSize.width,
        naturalH: newSize.height,
        containerW: containerSize.width,
        containerH: containerSize.height,
        coverScaleMin,
        currentCrop: localCrop
      });
    }
    
    onLoad?.(e);
  };

  // --- DETERMINISTISCHE CROP-BERECHNUNG ---
  // WICHTIG: Nur berechnen wenn Image geladen UND Sizes valid!
  const canCalculate = imageLoaded 
    && isValidSize(imageSize) 
    && isValidSize(containerSize);

  // CRITICAL: Detect derived images (already server-cropped)
  // Derived images have crop={scale:1, x:0, y:0} and should NOT apply transforms
  const isDerivedImage = localCrop.scale === 1.0 && localCrop.x === 0 && localCrop.y === 0;
  const isShopVariant = variant === 'card' || variant === 'shop' || variant === 'adminList';
  const skipTransform = isDerivedImage && isShopVariant;

  // SINGLE SOURCE OF TRUTH: computeCoverTransform (only for non-derived images)
  const transformData = !skipTransform && canCalculate
    ? computeCoverTransform({
        imgW: imageSize.width,
        imgH: imageSize.height,
        frameW: containerSize.width,
        frameH: containerSize.height,
        scale: localCrop.scale,
        x: localCrop.x,
        y: localCrop.y
      })
    : { transform: 'none', baseScale: 1, effectiveScale: 1 };

  const transform = skipTransform ? 'none' : transformData.transform;
  
  // coverScaleMin für Editor-UI (Slider min)
  const coverScaleMin = canCalculate
    ? calculateCoverScale(imageSize, containerSize)
    : 1.0;

  // Crop clampen damit Container IMMER gefüllt bleibt (für Drag-Handlers)
  const clampedCrop = canCalculate
    ? clampCropState(localCrop, imageSize, containerSize)
    : sanitizeCropState(localCrop);

  // --- DEBUG (nur Development) ---
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost' && canCalculate) {
      console.log(`[ProductImage ${variant}] Render:`, {
        src: src?.substring(0, 60),
        crop: clampedCrop,
        coverScaleMin,
        transformDebug: transformData.debug,
      });
    }
  }, [src, clampedCrop, coverScaleMin, variant, canCalculate, transformData]);

  // --- VARIANT-SPECIFIC STYLES ---
  const sizeClasses = {
    card: '',
    shop: '', // Shop-Cards nutzen variant="shop" (identisch zu card)
    adminList: '', // Größe wird vom Parent-Container bestimmt (60x75px)
    'admin-editor': 'max-w-[400px]',
  };

  const radiusClasses = {
    card: 'rounded-xl',
    shop: 'rounded-xl',
    adminList: 'rounded-lg',
    'admin-editor': 'rounded-xl',
  };

  // --- DRAG HANDLERS ---
  const handleMouseDown = (e) => {
    if (!interactive || !onCropChange || !canCalculate) {
      if (interactive && !canCalculate) {
        console.log('[ProductImage] Drag disabled - waiting for image load');
      }
      return;
    }
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ 
      x: e.clientX - clampedCrop.x, 
      y: e.clientY - clampedCrop.y 
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !onCropChange || !canCalculate) return;
    e.preventDefault();
    
    const newCrop = {
      scale: clampedCrop.scale,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    };

    // Clamp und propagieren
    const clamped = clampCropState(newCrop, imageSize, containerSize);
    onCropChange(clamped);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  // --- TOUCH SUPPORT ---
  const handleTouchStart = (e) => {
    if (!interactive || !onCropChange || !canCalculate) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ 
      x: touch.clientX - clampedCrop.x, 
      y: touch.clientY - clampedCrop.y 
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !onCropChange || !canCalculate) return;
    const touch = e.touches[0];
    
    const newCrop = {
      scale: clampedCrop.scale,
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    };

    const clamped = clampCropState(newCrop, imageSize, containerSize);
    onCropChange(clamped);
  };

  return (
    <div
      ref={containerRef}
      className={`product-image-container ${sizeClasses[variant]} ${radiusClasses[variant]} ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
      style={{
        cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
    >
      <img
        ref={imageRef}
        src={src || '/images/placeholder-product.jpg'}
        alt={alt}
        onLoad={handleImageLoad}
        onError={(e) => {
          e.target.src = '/images/placeholder-product.jpg';
          if (onError) onError(e);
        }}
        style={{ transform: skipTransform ? 'none' : transform }}
        data-derived={skipTransform ? 'true' : 'false'}
        draggable="false"
      />

      <style jsx>{`
        .product-image-container {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          user-select: none;
        }

        .product-image-container img {
          position: absolute;
          top: 50%;
          left: 50%;
         
        
        /* DERIVED IMAGES: Use object-fit instead of transform */
        .product-image-container img[data-derived="true"] {
          position: static;
          width: 100%;
          height: 100%;
          min-width: unset;
          min-height: unset;
          object-fit: cover;
          object-position: center;
          transform: none !important;
        } min-width: 100%;
          min-height: 100%;
          width: auto;
          height: auto;
          transform-origin: center center;
          transition: transform 0.1s ease-out;
        }

        .product-image-container img[draggable="false"] {
          -webkit-user-drag: none;
          -khtml-user-drag: none;
          -moz-user-drag: none;
          -o-user-drag: none;
          user-drag: none;
        }
      `}</style>
    </div>
  );
}
