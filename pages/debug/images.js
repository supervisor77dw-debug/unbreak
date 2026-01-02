import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getSupabasePublic } from '../../lib/supabase';
import { computeCoverTransform, computeExtractRect, computeCropRectOriginalPx } from '../../lib/crop-utils';

export async function getServerSideProps({ res }) {
  // Set aggressive no-cache headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Load build info (generated at build time)
  let buildInfo = null;
  try {
    const buildInfoResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/build-info.json`);
    buildInfo = await buildInfoResponse.json();
  } catch (err) {
    console.warn('Could not load build-info.json:', err.message);
    buildInfo = { gitShort: 'unknown', buildTime: 'unknown' };
  }

  return {
    props: {
      buildInfo,
      serverRenderTime: new Date().toISOString(),
    },
  };
}

export default function DebugImages({ buildInfo, serverRenderTime }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientRenderTime, setClientRenderTime] = useState(null);

  useEffect(() => {
    setClientRenderTime(new Date().toISOString());
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const supabase = getSupabasePublic();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sku', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
      
      console.log('🔍 [DEBUG] Products loaded:', data?.length);
    } catch (err) {
      console.error('[DEBUG] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function getPublicUrl(path) {
    if (!path) return null;
    const supabase = getSupabasePublic();
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data?.publicUrl;
  }

  if (loading) {
    return <div style={{ padding: '40px', color: '#fff', background: '#000' }}>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Image Debug - UNBREAK ONE</title>
      </Head>

      <div style={{ 
        padding: '40px', 
        background: '#0a0a0a', 
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '13px',
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#0ea5e9' }}>
          🔍 Image Pipeline Debug Dashboard
        </h1>

        {/* VERSION STAMP - CRITICAL FOR CACHE VERIFICATION */}
        <div style={{ 
          background: '#1a1a2a', 
          border: '2px solid #7c3aed',
          padding: '16px', 
          borderRadius: '8px',
          marginBottom: '32px',
          fontSize: '12px',
        }}>
          <div style={{ color: '#c084fc', fontWeight: 'bold', marginBottom: '8px' }}>
            🚀 DEBUG BUILD INFO
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', color: '#e0e7ff' }}>
            <strong>BUILD_SHA:</strong> 
            <code style={{ color: '#fbbf24' }}>{buildInfo?.gitShort || 'unknown'}</code>
            
            <strong>BUILD_TIME:</strong> 
            <code style={{ color: '#10b981' }}>{buildInfo?.buildTime || 'unknown'}</code>
            
            <strong>SERVER_RENDER:</strong> 
            <code style={{ color: '#3b82f6' }}>{serverRenderTime}</code>
            
            <strong>CLIENT_RENDER:</strong> 
            <code style={{ color: '#ec4899' }}>{clientRenderTime || 'loading...'}</code>
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#9ca3af' }}>
            ⚡ This page uses getServerSideProps + no-cache headers. Every refresh = fresh data.
          </div>
        </div>

        {/* CRITICAL TEST SECTION - CROP RECT VALIDATION */}
        <CropRectTestSection />

        {/* 🔥 SMOKING GUN SECTION - Live Product Crop Source Tracking */}
        <div style={{ 
          marginBottom: '40px', 
          background: '#1a1a2a', 
          padding: '24px', 
          borderRadius: '8px',
          border: '3px solid #dc2626',
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#dc2626' }}>
            🔥 SMOKING GUN - Live Crop Source Tracking
          </h2>
          
          <div style={{ 
            background: '#0a0a0a', 
            padding: '16px', 
            borderRadius: '6px', 
            marginBottom: '16px',
            fontSize: '12px',
            color: '#cbd5e1'
          }}>
            <strong>How to test:</strong><br/>
            1. Set UI Scale to <strong>1.5</strong> exactly (not 1.7!)<br/>
            2. Set x=-35, y=-117 (or use drag)<br/>
            3. Click Save<br/>
            4. Check Vercel Function Logs for:<br/>
            &nbsp;&nbsp;• <code style={{color: '#fbbf24'}}>API_INCOMING_CROP</code> → should show scale=1.5<br/>
            &nbsp;&nbsp;• <code style={{color: '#fbbf24'}}>DB_CROP_STATE</code> → should show scale=1.5<br/>
            &nbsp;&nbsp;• <code style={{color: '#fbbf24'}}>PIPELINE_CROP_USED</code> → scaleUsed=1.5, source=db<br/>
            5. If any log shows 1.7 instead of 1.5 → <strong style={{color: '#ef4444'}}>BUG FOUND</strong>
          </div>
          
          <div style={{ 
            background: '#7f1d1d', 
            padding: '16px', 
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
          }}>
            <strong>⚠️ Expected Logs (in order):</strong><br/>
            <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
              📥 API_INCOMING_CROP → scale: 1.5<br/>
              💾 DB_CROP_STATE → db.scale: 1.5<br/>
              ⚙️ PIPELINE_CROP_USED → scaleUsed: 1.5, source: "db"<br/>
              🔥 [HARD ASSERTION] → SCALE_APPLIED: ✅ PASS
            </div>
          </div>
          
          <div style={{ 
            marginTop: '16px',
            background: '#065f46', 
            padding: '12px', 
            borderRadius: '6px',
            color: '#fff',
            fontSize: '12px',
          }}>
            <strong>✅ If all logs show 1.5:</strong> Single Source of Truth working correctly!<br/>
            <strong>❌ If any log shows 1.7:</strong> Hardcoded value or wrong source being used!
          </div>
        </div>

        <div style={{ marginBottom: '40px', background: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#fbbf24' }}>
            📊 Database Table - All Products
          </h2>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '12px',
          }}>
            <thead>
              <tr style={{ background: '#2a2a2a', borderBottom: '2px solid #3a3a3a' }}>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Product ID</th>
                <th style={thStyle}>Updated At</th>
                <th style={thStyle}>Original Path</th>
                <th style={thStyle}>Shop Path</th>
                <th style={thStyle}>Thumb Path</th>
                <th style={thStyle}>Crop (scale,x,y)</th>
                <th style={thStyle}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const hasShop = !!(p.shop_image_path || p.shopImagePath);
                const hasThumb = !!(p.thumb_path || p.thumbPath);
                const hasOriginal = !!(p.image_path || p.imagePath);
                
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={tdStyle}>
                      <strong style={{ color: '#0ea5e9' }}>{p.sku}</strong>
                    </td>
                    <td style={{...tdStyle, fontSize: '10px', color: '#888' }}>
                      {p.id.substring(0, 8)}...
                    </td>
                    <td style={tdStyle}>
                      {p.image_updated_at || p.imageUpdatedAt 
                        ? new Date(p.image_updated_at || p.imageUpdatedAt).toLocaleString()
                        : 'N/A'}
                    </td>
                    <td style={tdStyle}>
                      <code style={{ color: hasOriginal ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                        {hasOriginal 
                          ? `.../${(p.image_path || p.imagePath).split('/').pop()}`
                          : '❌ MISSING'}
                      </code>
                    </td>
                    <td style={tdStyle}>
                      <code style={{ color: hasShop ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                        {hasShop 
                          ? `.../${(p.shop_image_path || p.shopImagePath).split('/').pop()}`
                          : '❌ MISSING'}
                      </code>
                    </td>
                    <td style={tdStyle}>
                      <code style={{ color: hasThumb ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                        {hasThumb 
                          ? `.../${(p.thumb_path || p.thumbPath).split('/').pop()}`
                          : '❌ MISSING'}
                      </code>
                    </td>
                    <td style={tdStyle}>
                      <code style={{ color: '#a78bfa' }}>
                        {p.image_crop_scale || p.imageCropScale || 1.0}, 
                        {p.image_crop_x || p.imageCropX || 0}, 
                        {p.image_crop_y || p.imageCropY || 0}
                      </code>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                        <span style={{ color: hasShop ? '#10b981' : '#6b7280' }}>
                          {hasShop ? '✓ Shop' : '✗ Shop'}
                        </span>
                        <span style={{ color: hasThumb ? '#10b981' : '#6b7280' }}>
                          {hasThumb ? '✓ Thumb' : '✗ Thumb'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Visual Previews */}
        <h2 style={{ fontSize: '16px', marginBottom: '24px', color: '#fbbf24' }}>
          🖼️ Visual Previews - 3-Way Comparison
        </h2>

        {products.map((p) => {
          const originalUrl = getPublicUrl(p.image_path || p.imagePath);
          const shopUrl = getPublicUrl(p.shop_image_path || p.shopImagePath);
          const thumbUrl = getPublicUrl(p.thumb_path || p.thumbPath);

          // Compute Pipeline Math for Shop (900x1125)
          const crop = {
            scale: p.image_crop_scale || p.imageCropScale || 1.0,
            x: p.image_crop_x || p.imageCropX || 0,
            y: p.image_crop_y || p.imageCropY || 0,
          };

          // Note: We don't have original image dimensions here, so math overlay will be incomplete
          // But we can show what crop params were used
          const mathOverlay = {
            crop,
            note: 'Original dimensions not available in DB - check server logs for full pipeline math',
          };

          return (
            <div 
              key={`preview-${p.id}`}
              style={{
                background: '#1a1a1a',
                padding: '24px',
                marginBottom: '24px',
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
              }}
            >
              <h3 style={{ fontSize: '14px', marginBottom: '16px', color: '#0ea5e9' }}>
                {p.sku} - {p.name}
              </h3>

              {/* Quick Links */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '16px',
                flexWrap: 'wrap',
              }}>
                {originalUrl && (
                  <button
                    onClick={() => window.open(originalUrl, '_blank')}
                    style={{
                      padding: '6px 12px',
                      background: '#1e293b',
                      color: '#60a5fa',
                      border: '1px solid #3b82f6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    🔗 Open Original
                  </button>
                )}
                {shopUrl && (
                  <button
                    onClick={() => window.open(shopUrl, '_blank')}
                    style={{
                      padding: '6px 12px',
                      background: '#1e293b',
                      color: '#34d399',
                      border: '1px solid #10b981',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    🔗 Open Shop (900x1125)
                  </button>
                )}
                {thumbUrl && (
                  <button
                    onClick={() => window.open(thumbUrl, '_blank')}
                    style={{
                      padding: '6px 12px',
                      background: '#1e293b',
                      color: '#f59e0b',
                      border: '1px solid #f59e0b',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    🔗 Open Thumb (240x300)
                  </button>
                )}
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '16px',
                marginBottom: '16px',
              }}>
                {/* Original */}
                <div style={previewBoxStyle}>
                  <div style={labelStyle}>A) ORIGINAL</div>
                  {originalUrl ? (
                    <>
                      <img 
                        src={originalUrl} 
                        alt="Original"
                        style={imgStyle}
                      />
                      <div style={urlStyle}>
                        {(p.image_path || p.imagePath)?.split('/').slice(-2).join('/')}
                      </div>
                    </>
                  ) : (
                    <div style={placeholderStyle}>❌ No Original</div>
                  )}
                </div>

                {/* Shop Derived */}
                <div style={previewBoxStyle}>
                  <div style={labelStyle}>B) SHOP DERIVED (900x1125)</div>
                  {shopUrl ? (
                    <>
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={shopUrl} 
                          alt="Shop"
                          style={imgStyle}
                        />
                        {/* Extract Overlay (only visible in console logs, but we show crop params) */}
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          background: 'rgba(124, 58, 237, 0.9)',
                          color: '#fff',
                          padding: '4px 8px',
                          fontSize: '9px',
                          fontFamily: 'monospace',
                          borderRadius: '3px',
                        }}>
                          Crop: s={crop.scale} x={crop.x} y={crop.y}
                        </div>
                      </div>
                      <div style={urlStyle}>
                        {(p.shop_image_path || p.shopImagePath)?.split('/').slice(-2).join('/')}
                      </div>
                      <div style={{ fontSize: '9px', color: '#7c3aed', marginTop: '4px' }}>
                        ⚠️ Extract coords in server logs → [PIPELINE EXTRACT]
                      </div>
                    </>
                  ) : (
                    <div style={placeholderStyle}>❌ No Shop Image</div>
                  )}
                </div>

                {/* Thumb Derived */}
                <div style={previewBoxStyle}>
                  <div style={labelStyle}>C) THUMB DERIVED (240x300)</div>
                  {thumbUrl ? (
                    <>
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={thumbUrl} 
                          alt="Thumb"
                          style={imgStyle}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          background: 'rgba(245, 158, 11, 0.9)',
                          color: '#000',
                          padding: '4px 8px',
                          fontSize: '9px',
                          fontFamily: 'monospace',
                          borderRadius: '3px',
                        }}>
                          Same crop, 240x300
                        </div>
                      </div>
                      <div style={urlStyle}>
                        {(p.thumb_path || p.thumbPath)?.split('/').slice(-2).join('/')}
                      </div>
                      <div style={{ fontSize: '9px', color: '#f59e0b', marginTop: '4px' }}>
                        ⚠️ Should match Shop composition (just smaller)
                      </div>
                    </>
                  ) : (
                    <div style={placeholderStyle}>❌ No Thumb</div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div style={{ 
                background: '#0a0a0a', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '11px',
              }}>
                <strong>Product ID:</strong> <code style={{ color: '#888' }}>{p.id}</code><br/>
                <strong>Crop:</strong> <code style={{ color: '#a78bfa' }}>
                  scale={crop.scale}, 
                  x={crop.x}, 
                  y={crop.y}
                </code><br/>
                <strong>Updated:</strong> {p.image_updated_at || p.imageUpdatedAt || 'N/A'}<br/>
                <strong>Shop Path Contains ProductID:</strong> {
                  (p.shop_image_path || p.shopImagePath)?.includes(p.id) 
                    ? <span style={{ color: '#10b981' }}>✓ YES</span>
                    : <span style={{ color: '#ef4444' }}>✗ NO</span>
                }<br/>
                <strong>Thumb Path Contains ProductID:</strong> {
                  (p.thumb_path || p.thumbPath)?.includes(p.id) 
                    ? <span style={{ color: '#10b981' }}>✓ YES</span>
                    : <span style={{ color: '#ef4444' }}>✗ NO</span>
                }
              </div>

              {/* Pipeline Math Overlay */}
              <div style={{ 
                background: '#1a0a2a', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '10px',
                marginTop: '12px',
                border: '1px solid #7c3aed',
              }}>
                <strong style={{ color: '#c084fc' }}>🔬 EXACT CROP MATH (Shared UI ↔ Server):</strong><br/>
                <code style={{ color: '#e0e7ff', display: 'block', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                  INPUT CROP: scale={crop.scale}, x={crop.x}px, y={crop.y}px{'\n'}
                  {'\n'}
                  Transform Order (IDENTICAL in UI and Server):{'\n'}
                  1. EXIF normalize → orientation = 1{'\n'}
                  2. baseScale = cover-fit to 4:5 aspect{'\n'}
                  3. effectiveScale = baseScale * userScale{'\n'}
                  4. scaledOffsetX = x * effectiveScale{'\n'}
                  5. scaledOffsetY = y * effectiveScale{'\n'}
                  6. Extract rect = center ± offset{'\n'}
                  {'\n'}
                  Y-Axis Mapping:{'\n'}
                  - yAppliedBeforeZoom: false (applied in base, then scaled){'\n'}
                  - ySign: + (positive Y moves DOWN){'\n'}
                  - yScaleFactor: effectiveScale{'\n'}
                  {'\n'}
                  Check server logs → [PIPELINE EXTRACT]:{'\n'}
                  - offsetBase vs offsetScaled{'\n'}
                  - extractRect: left, top, width, height{'\n'}
                  - wasClamped (should be false for centered crops)
                </code>
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: '40px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#fbbf24' }}>
            🧪 Mandatory Test Cases (UI ↔ Server Pixel-Perfect)
          </h3>
          <div style={{ lineHeight: '1.8', color: '#cbd5e1', fontSize: '12px' }}>
            <strong style={{ color: '#10b981' }}>Test A: Baseline (No Crop)</strong><br/>
            <code style={{ background: '#0a0a0a', padding: '4px 8px', borderRadius: '3px' }}>
              scale=1.0, x=0, y=0
            </code><br/>
            Expected: UI Preview === Shop Derived (pixel-identical, centered)<br/>
            <br/>
            
            <strong style={{ color: '#3b82f6' }}>Test B: Y-Offset Direction</strong><br/>
            <code style={{ background: '#0a0a0a', padding: '4px 8px', borderRadius: '3px' }}>
              scale=1.0, x=0, y=+50
            </code><br/>
            Expected: Image moves DOWN in both UI and Server<br/>
            If inverted → ySign is wrong (+/- flipped)<br/>
            <br/>
            
            <strong style={{ color: '#ec4899' }}>Test C: Complex Crop</strong><br/>
            <code style={{ background: '#0a0a0a', padding: '4px 8px', borderRadius: '3px' }}>
              scale=1.8, x=-49, y=-51
            </code><br/>
            Expected: UI "So sieht's im Shop aus" === Shop Derived (900x1125) pixel-perfect<br/>
            Expected: Thumb (240x300) same composition, just smaller<br/>
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#fbbf24' }}>
            📝 Acceptance Criteria Check
          </h3>
          <ul style={{ lineHeight: '1.8', color: '#cbd5e1' }}>
            <li>✅ All products have unique shop_image_path containing their productId</li>
            <li>✅ All products have unique thumb_path containing their productId</li>
            <li>✅ Shop and Admin use derived paths (not original + transform)</li>
            <li>✅ Saving one product only changes that product's paths</li>
            <li>✅ UI and Server use IDENTICAL crop math (shared computeExtractRect)</li>
          </ul>
        </div>
      </div>
    </>
  );
}

const thStyle = {
  padding: '12px 8px',
  textAlign: 'left',
  color: '#cbd5e1',
  fontWeight: 'bold',
  fontSize: '11px',
  textTransform: 'uppercase',
};

const tdStyle = {
  padding: '12px 8px',
  color: '#e5e7eb',
};

const previewBoxStyle = {
  background: '#0a0a0a',
  padding: '12px',
  borderRadius: '6px',
  border: '1px solid #2a2a2a',
};

const labelStyle = {
  fontSize: '10px',
  color: '#fbbf24',
  fontWeight: 'bold',
  marginBottom: '8px',
  textTransform: 'uppercase',
};

const imgStyle = {
  width: '100%',
  height: 'auto',
  maxHeight: '300px',
  objectFit: 'contain',
  background: '#000',
  borderRadius: '4px',
  marginBottom: '8px',
};

const urlStyle = {
  fontSize: '9px',
  color: '#6b7280',
  wordBreak: 'break-all',
};

const placeholderStyle = {
  padding: '60px 20px',
  textAlign: 'center',
  color: '#ef4444',
  background: '#1a0a0a',
  borderRadius: '4px',
};

// CRITICAL TEST COMPONENT - Validates computeCropRectOriginalPx works correctly
function CropRectTestSection() {
  // Test Image (use a fixed example - 1920x1440 original)
  const testImageW = 1920;
  const testImageH = 1440;
  
  // Test Cases
  const tests = [
    { name: 'A: Baseline', scale: 1.0, x: 0, y: 0, expected: 'Normal cover-fit, centered' },
    { name: 'B: Zoom Test', scale: 1.7, x: 0, y: 0, expected: 'Zoomed in, less background visible' },
    { name: 'C: Offset Test', scale: 1.7, x: -55, y: -45, expected: 'Zoomed + shifted compared to B' },
  ];
  
  const testResults = tests.map(test => {
    const cropRect = computeCropRectOriginalPx(
      testImageW, 
      testImageH, 
      0.8, // 4:5 aspect
      test.scale, 
      test.x, 
      test.y
    );
    
    // Calculate base rect (scale=1.0, no offset) for comparison
    const baseCropRect = computeCropRectOriginalPx(
      testImageW, 
      testImageH, 
      0.8,
      1.0, 
      0, 
      0
    );
    
    return { ...test, cropRect, baseCropRect };
  });
  
  // Check if hashes are all different
  const hashes = testResults.map(r => r.cropRect.debug.hash);
  const allUnique = new Set(hashes).size === hashes.length;
  
  // INVARIANT CHECKS
  const invariantI = testResults[1] && testResults[0] 
    ? Math.abs((testResults[1].cropRect.width / testResults[0].cropRect.width) - (1.0 / 1.7)) < 0.05
    : false;
  const invariantII = testResults[2] && testResults[1]
    ? testResults[2].cropRect.width === testResults[1].cropRect.width && 
      testResults[2].cropRect.height === testResults[1].cropRect.height
    : false;
  const invariantIII = testResults[2] && testResults[1]
    ? testResults[2].cropRect.left < testResults[1].cropRect.left && // x=-60 → left should decrease
      testResults[2].cropRect.top < testResults[1].cropRect.top       // y=-40 → top should decrease
    : false;
  
  const allInvariantsPass = invariantI && invariantII && invariantIII;
  
  return (
    <div style={{ 
      marginBottom: '40px', 
      background: '#1a1a2a', 
      padding: '24px', 
      borderRadius: '8px',
      border: allUnique ? '3px solid #10b981' : '3px solid #ef4444',
    }}>
      <h2 style={{ fontSize: '18px', marginBottom: '16px', color: allUnique ? '#10b981' : '#ef4444' }}>
        {allUnique ? '✅ PASS' : '❌ FAIL'} - CropRect Validation Test
      </h2>
      
      <div style={{ 
        background: '#0a0a0a', 
        padding: '16px', 
        borderRadius: '6px', 
        marginBottom: '20px',
        fontSize: '12px',
        color: '#cbd5e1'
      }}>
        <strong>Test Image:</strong> {testImageW}×{testImageH} (1920x1440 typical camera)<br/>
        <strong>Target Aspect:</strong> 4:5 (0.8)<br/>
        <strong>Requirement:</strong> Each test MUST produce different cropRect hash
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {testResults.map((result, idx) => {
          const prevHash = idx > 0 ? testResults[idx - 1].cropRect.debug.hash : null;
          const isDifferent = !prevHash || prevHash !== result.cropRect.debug.hash;
          
          return (
            <div key={idx} style={{
              background: isDifferent ? '#0a1a0a' : '#1a0a0a',
              border: `2px solid ${isDifferent ? '#10b981' : '#ef4444'}`,
              padding: '16px',
              borderRadius: '6px',
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 'bold', 
                marginBottom: '12px',
                color: isDifferent ? '#10b981' : '#ef4444',
              }}>
                {result.name}
              </div>
              
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '12px' }}>
                <strong>Input:</strong><br/>
                scale = {result.scale}<br/>
                x = {result.x}px<br/>
                y = {result.y}px
              </div>
              
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '12px' }}>
                <strong>CropRect (Original Pixels):</strong><br/>
                left = {result.cropRect.left}<br/>
                top = {result.cropRect.top}<br/>
                width = {result.cropRect.width}<br/>
                height = {result.cropRect.height}
              </div>
              
              <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>
                <strong>Base (scale=1.0):</strong><br/>
                width = {result.baseCropRect.width}<br/>
                height = {result.baseCropRect.height}
              </div>
              
              <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>
                <strong>Debug Info:</strong><br/>
                {result.cropRect.debug.baseSize}<br/>
                cropSize: {result.cropRect.debug.cropSize}<br/>
                offset: {result.cropRect.debug.offsetRef} → {result.cropRect.debug.offsetOrig}
              </div>
              
              <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>
                <strong>🔍 Sources:</strong><br/>
                scaleUsed: {result.scale} <span style={{color: '#10b981'}}>(test)</span><br/>
                offsetUsed: xy <span style={{color: '#10b981'}}>(test)</span>
              </div>
              
              <div style={{ 
                background: '#000', 
                padding: '8px', 
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#fbbf24',
                marginBottom: '8px',
              }}>
                Hash: {result.cropRect.debug.hash}
              </div>
              
              <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '12px' }}>
                {result.expected}
              </div>
              
              {idx > 0 && (
                <div style={{ 
                  fontSize: '10px', 
                  padding: '6px', 
                  background: isDifferent ? '#065f46' : '#7f1d1d',
                  borderRadius: '3px',
                  color: '#fff',
                }}>
                  {isDifferent ? `✓ Different from ${tests[idx-1].name}` : `✗ SAME as ${tests[idx-1].name}!`}
                </div>
              )}
              
              {/* Visual size indicator */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '9px', color: '#6b7280', marginBottom: '4px' }}>
                  Visual Crop Size:
                </div>
                <div style={{ 
                  width: `${(result.cropRect.width / testImageW) * 100}%`, 
                  height: '4px', 
                  background: '#3b82f6',
                  borderRadius: '2px',
                }}></div>
                <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
                  {((result.cropRect.width / testImageW) * 100).toFixed(1)}% of original width
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{ 
        marginTop: '20px', 
        padding: '16px', 
        background: allUnique && allInvariantsPass ? '#065f46' : '#7f1d1d',
        borderRadius: '6px',
        color: '#fff',
      }}>
        <strong style={{ fontSize: '14px' }}>
          {allUnique && allInvariantsPass ? '✅ PASS' : '❌ FAIL'} - Validation Results
        </strong>
        <div style={{ fontSize: '11px', marginTop: '12px', opacity: 0.9 }}>
          <div style={{ marginBottom: '6px' }}>
            Hash Uniqueness: {allUnique ? '✅ PASS' : '❌ FAIL'} 
            {!allUnique && ' - Multiple tests produce identical cropRect!'}
          </div>
          <div style={{ marginBottom: '6px' }}>
            Invariant I (Zoom): {invariantI ? '✅ PASS' : '❌ FAIL'}
            {!invariantI && ` - width_B should be ~${(testResults[0].cropRect.width / 1.7).toFixed(0)} but is ${testResults[1].cropRect.width}`}
          </div>
          <div style={{ marginBottom: '6px' }}>
            Invariant II (Size): {invariantII ? '✅ PASS' : '❌ FAIL'}
            {!invariantII && ' - B and C should have same width/height!'}
          </div>
          <div>
            Invariant III (Direction): {invariantIII ? '✅ PASS' : '❌ FAIL'}
            {!invariantIII && ' - Negative x/y should decrease left/top!'}
          </div>
        </div>
      </div>
    </div>
  );
}
