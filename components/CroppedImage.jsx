// SINGLE SOURCE OF TRUTH: Crop Rendering
// Renders image with crop transform - NO conditional logic, NO variants
// Used by BOTH Editor and Preview to ensure identical rendering

import { computeCoverTransform } from '../lib/crop-utils';
import { useState, useRef, useEffect, useCallback } from 'react';

export default function CroppedImage({ src, alt, crop, aspect = '4/5', interactive = false, onCropChange, onImageLoad, showDebug = false }) {
  const [imageSize, setImageSize] = useState(null);
  const [containerSize, setContainerSize] = useState(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, nx: 0, ny: 0 });
  const [currentDelta, setCurrentDelta] = useState({ dx: 0, dy: 0 });

  // Reconstruct dx/dy from normalized offsets for display
  const dx = (crop.nx || 0) * (containerSize?.width || 1);
  const dy = (crop.ny || 0) * (containerSize?.height || 1);

  // Measure container on mount/resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const measureContainer = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;
      
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    };
    
    // Initial measurement
    measureContainer();
    
    const observer = new ResizeObserver(measureContainer);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute transform ONLY if sizes are available
  // Use reconstructed dx/dy from normalized offsets
  const transformResult = imageSize && containerSize
    ? computeCoverTransform({
        imgW: imageSize.width,
        imgH: imageSize.height,
        frameW: containerSize.width,
        frameH: containerSize.height,
        scale: crop.scale,
        x: dx,  // Reconstructed from nx
        y: dy   // Reconstructed from ny
      })
    : { transform: 'none', debug: {} };
  
  const transform = transformResult.transform;

  // Drag handlers (only if interactive)
  const handleMouseDown = (e) => {
    if (!interactive) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      nx: crop.nx || 0,
      ny: crop.ny || 0
    };
  };

  const handleMouseMove = useCallback((e) => {
    if (!interactive || !isDragging || !containerSize || !dragStartRef.current) return;
    e.preventDefault();
    
    const pixelDx = e.clientX - dragStartRef.current.x;
    const pixelDy = e.clientY - dragStartRef.current.y;
    
    setCurrentDelta({ dx: pixelDx, dy: pixelDy });
    
    // Compute normalized offsets from pixel delta
    const newNx = dragStartRef.current.nx + (pixelDx / containerSize.width);
    const newNy = dragStartRef.current.ny + (pixelDy / containerSize.height);
    
    const newCrop = {
      scale: crop.scale,
      nx: newNx,
      ny: newNy,
      cropVersion: 2  // NEW: Mark as v2 format
    };
    
    // 🔥 CROP_UI_SAVE: Log with normalized offsets
    if (showDebug) {
      console.log('[CROP_UI_SAVE] drag', {
        timestamp: new Date().toISOString(),
        scale: crop.scale,
        viewportW: containerSize.width,
        viewportH: containerSize.height,
        dx: pixelDx,
        dy: pixelDy,
        nx: newNx,
        ny: newNy,
        formula: `nx=${dragStartRef.current.nx}+(${pixelDx}/${containerSize.width})=${newNx}`,
        cropVersion: 2
      });
    }
    
    if (onCropChange) {
      onCropChange(newCrop);
    }
  }, [interactive, isDragging, containerSize, crop.scale, onCropChange, showDebug]);

  const handleMouseUp = useCallback(() => {
    if (!interactive) return;
    setIsDragging(false);
  }, [interactive]);

  useEffect(() => {
    if (!interactive || !isDragging) return;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, interactive, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className={`cropped-image-container ${interactive ? 'interactive' : ''}`}
      onMouseDown={handleMouseDown}
    >
      <img
        ref={imageRef}
        src={src || '/images/placeholder-product.jpg'}
        alt={alt || 'Product'}
        onLoad={(e) => {
          const newSize = {
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
          };
          setImageSize(newSize);
          if (onImageLoad) {
            onImageLoad(newSize);
          }
        }}
        onError={(e) => {
          e.target.src = '/images/placeholder-product.jpg';
        }}
        style={{ transform }}
        draggable="false"
      />

      {showDebug && interactive && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(0,0,0,0.8)',
          color: '#0f0',
          padding: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 1000,
        }}>
          <div>scale: {crop.scale.toFixed(2)}</div>
          <div>nx: {(crop.nx || 0).toFixed(4)} ny: {(crop.ny || 0).toFixed(4)}</div>
          <div>dx: {dx.toFixed(0)}px dy: {dy.toFixed(0)}px</div>
          <div style={{fontSize: '9px', marginTop: '4px', opacity: 0.7}}>
            viewport: {containerSize?.width || 0}×{containerSize?.height || 0}
          </div>
          <div style={{fontSize: '9px', opacity: 0.7}}>
            version: v2 (normalized offsets)
          </div>
          <div style={{fontSize: '9px', opacity: 0.7}}>
            transform: {transform.substring(0, 40)}...
          </div>
        </div>
      )}

      <style jsx>{`
        .cropped-image-container {
          position: relative;
          width: 100%;
          aspect-ratio: ${aspect};
          overflow: hidden;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }

        .cropped-image-container.interactive {
          cursor: ${isDragging ? 'grabbing' : 'grab'};
          user-select: none;
        }

        .cropped-image-container img {
          position: absolute;
          top: 50%;
          left: 50%;
          min-width: 100%;
          min-height: 100%;
          width: auto;
          height: auto;
          transform-origin: center center;
          object-fit: none;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
