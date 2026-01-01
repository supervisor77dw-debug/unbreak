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
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
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

  // coverScaleMin: minimales Scale damit Bild Container füllt (mathematisch exakt)
  const coverScaleMin = canCalculate
    ? calculateCoverScale(imageSize, containerSize)
    : 1.0;

  // Crop clampen damit Container IMMER gefüllt bleibt (keine leeren Bereiche)
  const clampedCrop = canCalculate
    ? clampCropState(localCrop, imageSize, containerSize)
    : sanitizeCropState(localCrop);

  // Transform-String generieren (CSS-ready)
  const transform = generateTransform(clampedCrop);

  // --- DEBUG (nur Development) ---
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
      console.log(`[ProductImage ${variant}] Render:`, {
        src: src?.substring(0, 60),
        crop: clampedCrop,
        coverScaleMin,
        imageSize,
        containerSize,
        transform,
      });
    }
  }, [src, clampedCrop, coverScaleMin, variant, transform, imageSize, containerSize]);

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
        style={{ transform }}
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
          min-width: 100%;
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
