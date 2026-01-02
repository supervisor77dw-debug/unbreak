// SINGLE SOURCE OF TRUTH: Crop Rendering
// Renders image with crop transform - NO conditional logic, NO variants
// Used by BOTH Editor and Preview to ensure identical rendering

import { computeCoverTransform } from '../lib/crop-utils';
import { useState, useRef, useEffect } from 'react';

export default function CroppedImage({ src, alt, crop, aspect = '4/5', interactive = false, onCropChange, onImageLoad, showDebug = false }) {
  const [imageSize, setImageSize] = useState(null);
  const [containerSize, setContainerSize] = useState(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });
  const [lastDelta, setLastDelta] = useState({ dx: 0, dy: 0 });

  // Measure container on mount/resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute transform ONLY if sizes are available
  const transformResult = imageSize && containerSize
    ? computeCoverTransform({
        imgW: imageSize.width,
        imgH: imageSize.height,
        frameW: containerSize.width,
        frameH: containerSize.height,
        scale: crop.scale,
        x: crop.x,
        y: crop.y
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
      cropX: crop.x,
      cropY: crop.y
    };
  };

  const handleMouseMove = (e) => {
    if (!interactive || !isDragging) return;
    e.preventDefault();
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    setLastDelta({ dx, dy });
    
    const newCrop = {
      scale: crop.scale,
      x: dragStartRef.current.cropX + dx,
      y: dragStartRef.current.cropY + dy
    };
    
    if (onCropChange) {
      onCropChange(newCrop);
    }
  };

  const handleMouseUp = () => {
    if (!interactive) return;
    setIsDragging(false);
  };

  useEffect(() => {
    if (!interactive) return;
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, interactive]);

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
          <div>x: {crop.x.toFixed(0)} y: {crop.y.toFixed(0)}</div>
          <div>dx: {lastDelta.dx.toFixed(0)} dy: {lastDelta.dy.toFixed(0)}</div>
          <div style={{fontSize: '9px', marginTop: '4px', opacity: 0.7}}>
            transform: {transform.substring(0, 40)}...
          </div>
          <div style={{fontSize: '9px', opacity: 0.7}}>
            mode: {transformResult.debug?.mode || 'unknown'}
          </div>
          <div style={{fontSize: '9px', opacity: 0.7}}>
            invertedY: false (drag down = img down)
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
