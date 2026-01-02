// DEBUG: Test CSS Transform vs Sharp Extract Math
// This page shows side-by-side what CSS and Sharp would do with same params

import { useState } from 'react';
import { computeCoverTransform, computeExtractRect } from '../../lib/crop-utils';

export default function CropMathTest() {
  const [params, setParams] = useState({
    imgW: 1920,
    imgH: 1440,
    targetW: 900,
    targetH: 1125,
    scale: 1.9,
    x: -49,
    y: -51,
  });

  // Compute both methods
  const cssResult = computeCoverTransform({
    imgW: params.imgW,
    imgH: params.imgH,
    frameW: params.targetW,
    frameH: params.targetH,
    scale: params.scale,
    x: params.x,
    y: params.y,
  });

  const sharpResult = computeExtractRect({
    origW: params.imgW,
    origH: params.imgH,
    targetW: params.targetW,
    targetH: params.targetH,
    scale: params.scale,
    x: params.x,
    y: params.y,
  });

  // Calculate what CSS ACTUALLY does in pixel space
  // CSS: img positioned at center, then transform applied
  // position: absolute; top: 50%; left: 50%; (center point of container)
  // transform-origin: center center (center point of image)
  //
  // After scale(effectiveScale):
  // - Image visual size = imgW * effectiveScale × imgH * effectiveScale
  //
  // After translate(calc(-50% + xpx), calc(-50% + ypx)):
  // - -50% moves image center to container top-left
  // - +x, +y offset from there
  //
  // Visual extract rect (what's visible in container):
  // - Container shows targetW × targetH
  // - Image is scaled to scaledW × scaledH visually
  // - Center of container = center of scaled image + offset
  //
  // Map back to original image pixels:
  const scaledW = params.imgW * cssResult.effectiveScale;
  const scaledH = params.imgH * cssResult.effectiveScale;
  
  // In CSS, the translate happens AFTER scale
  // So offsets are in the SCALED space (visual pixels)
  // But they're expressed in CONTAINER pixels
  //
  // Container center = scaledImage center + offset
  // Extract rect top-left = scaledImage center - targetW/2 + offsetX
  const cssExtractLeft = Math.round(scaledW/2 - params.targetW/2 + params.x);
  const cssExtractTop = Math.round(scaledH/2 - params.targetH/2 + params.y);

  const match = {
    left: cssExtractLeft === sharpResult.left,
    top: cssExtractTop === sharpResult.top,
    all: cssExtractLeft === sharpResult.left && cssExtractTop === sharpResult.top,
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'monospace' }}>
      <h1>🔬 Crop Math Test: CSS vs Sharp</h1>
      
      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <h2>Input Parameters</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          <div>
            <label>Image W: <input type="number" value={params.imgW} onChange={e => setParams({...params, imgW: parseInt(e.target.value)})} style={{width: '100px'}} /></label>
          </div>
          <div>
            <label>Image H: <input type="number" value={params.imgH} onChange={e => setParams({...params, imgH: parseInt(e.target.value)})} style={{width: '100px'}} /></label>
          </div>
          <div>
            <label>Target W: <input type="number" value={params.targetW} onChange={e => setParams({...params, targetW: parseInt(e.target.value)})} style={{width: '100px'}} /></label>
          </div>
          <div>
            <label>Target H: <input type="number" value={params.targetH} onChange={e => setParams({...params, targetH: parseInt(e.target.value)})} style={{width: '100px'}} /></label>
          </div>
          <div>
            <label>Scale: <input type="number" step="0.1" value={params.scale} onChange={e => setParams({...params, scale: parseFloat(e.target.value)})} style={{width: '100px'}} /></label>
          </div>
          <div>
            <label>X: <input type="number" value={params.x} onChange={e => setParams({...params, x: parseInt(e.target.value)})} style={{width: '100px'}} /></label>
          </div>
          <div>
            <label>Y: <input type="number" value={params.y} onChange={e => setParams({...params, y: parseInt(e.target.value)})} style={{width: '100px'}} /></label>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px' }}>
          <h2>CSS Transform (UI)</h2>
          <pre style={{ background: '#0f172a', padding: '15px', borderRadius: '4px', overflow: 'auto' }}>
{`Transform: ${cssResult.transform}

Base Scale: ${cssResult.baseScale.toFixed(4)}
Effective Scale: ${cssResult.effectiveScale.toFixed(4)}

Scaled Image Size:
  ${scaledW.toFixed(0)}px × ${scaledH.toFixed(0)}px

What CSS Actually Extracts:
  left: ${cssExtractLeft}
  top: ${cssExtractTop}
  width: ${params.targetW}
  height: ${params.targetH}

Calculation:
  scaledW = imgW * effectiveScale
         = ${params.imgW} * ${cssResult.effectiveScale.toFixed(4)}
         = ${scaledW.toFixed(0)}px
  
  left = scaledW/2 - targetW/2 + offsetX
       = ${(scaledW/2).toFixed(1)} - ${params.targetW/2} + ${params.x}
       = ${cssExtractLeft}
  
  top = scaledH/2 - targetH/2 + offsetY
      = ${(scaledH/2).toFixed(1)} - ${params.targetH/2} + ${params.y}
      = ${cssExtractTop}`}
          </pre>
        </div>

        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px' }}>
          <h2>Sharp Extract (Server)</h2>
          <pre style={{ background: '#0f172a', padding: '15px', borderRadius: '4px', overflow: 'auto' }}>
{`computeExtractRect() returns:
  left: ${sharpResult.left}
  top: ${sharpResult.top}
  width: ${sharpResult.width}
  height: ${sharpResult.height}

Debug Info:
${JSON.stringify(sharpResult.debug, null, 2)}`}
          </pre>
        </div>
      </div>

      <div style={{ 
        background: match.all ? '#065f46' : '#991b1b', 
        padding: '20px', 
        borderRadius: '8px',
        border: `3px solid ${match.all ? '#10b981' : '#ef4444'}`
      }}>
        <h2>{match.all ? '✅ MATCH!' : '❌ MISMATCH!'}</h2>
        <pre style={{ background: '#0f172a', padding: '15px', borderRadius: '4px' }}>
{`CSS Extract:   left=${cssExtractLeft}, top=${cssExtractTop}
Sharp Extract: left=${sharpResult.left}, top=${sharpResult.top}

Left Match: ${match.left ? '✅' : '❌'} ${match.left ? '' : `(diff: ${cssExtractLeft - sharpResult.left})`}
Top Match: ${match.top ? '✅' : '❌'} ${match.top ? '' : `(diff: ${cssExtractTop - sharpResult.top})`}`}
        </pre>
      </div>

      <div style={{ marginTop: '30px', background: '#1e293b', padding: '20px', borderRadius: '8px' }}>
        <h3>🎯 Goal: Make CSS and Sharp produce IDENTICAL extract rects</h3>
        <p>The CSS transform must visually show the EXACT same crop as Sharp will extract.</p>
        <p>If mismatch: The offset calculation in CSS or Sharp needs adjustment.</p>
      </div>
    </div>
  );
}
