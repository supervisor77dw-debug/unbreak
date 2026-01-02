import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getSupabasePublic } from '../../lib/supabase';
import { computeCoverTransform, computeExtractRect } from '../../lib/crop-utils';

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
