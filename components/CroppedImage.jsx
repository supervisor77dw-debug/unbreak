// SINGLE SOURCE OF TRUTH: Crop Rendering
// Renders image with crop transform - NO conditional logic, NO variants
// Used by BOTH Editor and Preview to ensure identical rendering

import { computeCoverTransform } from '../lib/crop-utils';
import { useState, useRef, useEffect } from 'react';

export default function CroppedImage({ src, alt, crop, aspect = '4/5', interactive = false, onCropChange }) {
  const [imageSize, setImageSize] = useState(null);
  const [containerSize, setContainerSize] = useState(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });

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
  const transform = imageSize && containerSize
    ? computeCoverTransform({
        imgW: imageSize.width,
        imgH: imageSize.height,
        frameW: containerSize.width,
        frameH: containerSize.height,
        scale: crop.scale,
        x: crop.x,
        y: crop.y
      }).transform
    : 'none';

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
          setImageSize({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
          });
        }}
        onError={(e) => {
          e.target.src = '/images/placeholder-product.jpg';
        }}
        style={{ transform }}
        draggable="false"
      />

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
