import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AdminLayout from '../../../components/AdminLayout';
import { getColorHex, getColorDisplayName } from '../../../lib/configValidation';

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!id) return;
    
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch order: ${res.status}`);
        }
        const data = await res.json();
        
        // BUILD MARKER - Deployment verification
        console.log('🔵 BUILD_MARKER: 1b1fe4e-DIAGNOSTIC');
        
        // DIAGNOSE: Log order fields for color visibility debug
        console.log('[ORDER DETAIL] Order data:');
        console.log('  ID:', data.id?.substring(0, 8));
        console.log('  🎨 configJson (Prisma camelCase):', !!data.configJson);
        console.log('  configJson value:', JSON.stringify(data.configJson, null, 2));
        console.log('  colors:', data.configJson?.colors);
        console.log('  hasItems:', !!data.items?.length);
        console.log('  All keys:', Object.keys(data));
        
        // RAW RESPONSE - Complete structure analysis
        console.log('[ORDER RAW] Full response:', data);
        console.log('[ORDER KEYS] Top-level keys:', Object.keys(data));
        
        // RECURSIVE DIAGNOSTIC - Check all possible config locations
        console.log('[CONFIG SEARCH] Checking all possible locations:');
        console.log('  1. data.config_json:', !!data.config_json);
        console.log('  2. data.configJson:', !!data.configJson);
        console.log('  3. data.config:', !!data.config);
        console.log('  4. data.configuration:', !!data.configuration);
        console.log('  5. data.items?.[0]?.config:', !!data.items?.[0]?.config);
        console.log('  6. data.items?.[0]?.config_json:', !!data.items?.[0]?.config_json);
        console.log('  7. data.metadata?.config:', !!data.metadata?.config);
        console.log('  8. data.stripeCheckoutSessionId:', data.stripeCheckoutSessionId);
        
        setOrder(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
  }, [id]);

  async function updateStatus(field, value) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      
      if (!res.ok) throw new Error('Update failed');
      
      const updated = await res.json();
      setOrder(updated);
    } catch (err) {
      alert('Failed to update: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <AdminLayout>
        <div className="loading">Bestellung wird geladen...</div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="error-state">
          <h2>Fehler</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/admin/orders')}>← Zurück zu Bestellungen</button>
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="error-state">
          <h2>Bestellung nicht gefunden</h2>
          <button onClick={() => router.push('/admin/orders')}>← Zurück zu Bestellungen</button>
        </div>
      </AdminLayout>
    );
  }

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: order.currency || 'EUR',
    }).format(cents / 100);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getPaymentBadge = (status) => {
    const styles = {
      PAID: { bg: '#065f46', text: '#d1fae5' },
      PENDING: { bg: '#854d0e', text: '#fef3c7' },
      FAILED: { bg: '#991b1b', text: '#fee2e2' },
      REFUNDED: { bg: '#7c2d12', text: '#fed7aa' },
    };
    const style = styles[status] || styles.PENDING;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        backgroundColor: style.bg,
        color: style.text,
      }}>
        {status}
      </span>
    );
  };

  const getFulfillmentBadge = (status) => {
    const styles = {
      NEW: { bg: '#1e3a8a', text: '#dbeafe' },
      PROCESSING: { bg: '#854d0e', text: '#fef3c7' },
      SHIPPED: { bg: '#065f46', text: '#d1fae5' },
      DONE: { bg: '#374151', text: '#e5e7eb' },
      CANCELED: { bg: '#991b1b', text: '#fee2e2' },
    };
    const style = styles[status] || styles.NEW;
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        backgroundColor: style.bg,
        color: style.text,
      }}>
        {status}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="order-detail">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/admin/orders')}>
            ← Zurück
          </button>
          <div className="title-section">
            <h1>Bestelldetails</h1>
            <div className="order-id">ID: {order.id.substring(0, 8)}...</div>
          </div>
        </div>

        <div className="content">
          {/* Status Cards */}
          <div className="status-section">
            <div className="status-card">
              <label>Zahlungsstatus</label>
              <select
                value={order.statusPayment}
                onChange={(e) => updateStatus('statusPayment', e.target.value)}
                disabled={updating}
              >
                <option value="PENDING">Ausstehend</option>
                <option value="PAID">Bezahlt</option>
                <option value="FAILED">Fehlgeschlagen</option>
                <option value="REFUNDED">Erstattet</option>
              </select>
            </div>

            <div className="status-card">
              <label>Versandstatus</label>
              <select
                value={order.statusFulfillment}
                onChange={(e) => updateStatus('statusFulfillment', e.target.value)}
                disabled={updating}
              >
                <option value="NEW">Neu</option>
                <option value="PROCESSING">In Bearbeitung</option>
                <option value="SHIPPED">Versandt</option>
                <option value="DONE">Abgeschlossen</option>
                <option value="CANCELED">Storniert</option>
              </select>
            </div>
          </div>

          {/* Customer Info */}
          <div className="info-card">
            <h2>Kunde</h2>
            <div className="info-grid">
              <div>
                <strong>E-Mail:</strong>
                <span>{order.email || order.customer_email || order.customerEmail || '—'}</span>
              </div>
              {(order.shippingName || order.customer_name || order.customerName) && (
                <div>
                  <strong>Name:</strong>
                  <span>{order.shippingName || order.customer_name || order.customerName}</span>
                </div>
              )}
              {(order.customer_phone || order.customerPhone) && (
                <div>
                  <strong>Telefon:</strong>
                  <span>{order.customer_phone || order.customerPhone}</span>
                </div>
              )}
              {order.customer && (
                <div>
                  <strong>Kunden-ID:</strong>
                  <span title={order.customer.id}>{order.customer.id.substring(0, 8)}...</span>
                </div>
              )}
              {(order.stripe_customer_id || order.stripeCustomerId) && (
                <div>
                  <strong>Stripe Customer:</strong>
                  <span className="mono" style={{ fontSize: '12px' }}>
                    {order.stripe_customer_id || order.stripeCustomerId}
                  </span>
                </div>
              )}
              {!order.customer && !order.customer_id && (
                <div style={{ gridColumn: '1 / -1', padding: '12px', background: '#854d0e', borderRadius: '6px' }}>
                  <strong style={{ color: '#fef3c7' }}>⚠️ Customer nicht verknüpft</strong>
                  <p style={{ color: '#fef3c7', fontSize: '13px', margin: '4px 0 0 0' }}>
                    Webhook möglicherweise nicht verarbeitet oder Customer-Sync fehlgeschlagen
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="info-card">
            <h2>📦 Bestellte Produkte</h2>
            {(order.items || order.items_json) ? (
              <div className="items-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #404040' }}>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Produkt</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>SKU</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Menge</th>
                      <th style={{ textAlign: 'right', padding: '12px 8px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Stückpreis</th>
                      <th style={{ textAlign: 'right', padding: '12px 8px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const items = order.items || order.items_json || [];
                      const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
                      
                      return itemsArray.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ color: '#d4f1f1', fontWeight: '500' }}>
                              {item.name || item.product_name || 'Produkt'}
                            </div>
                            {item.config && (
                              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                                {item.config.colors ? (
                                  <span>🎨 {Object.entries(item.config.colors).map(([area, color]) => `${area}: ${color}`).join(', ')}</span>
                                ) : item.config.color ? (
                                  <span>🎨 {item.config.color}</span>
                                ) : null}
                                {item.config.finish && <span> • {item.config.finish}</span>}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                            <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', color: '#0891b2' }}>
                              {item.sku || item.product_sku || '—'}
                            </code>
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 8px', color: '#d4f1f1' }}>
                            {item.quantity || 1}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 8px', color: '#d4f1f1', fontFamily: 'monospace' }}>
                            {formatCurrency(item.unit_price_cents || 0)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 8px', color: '#d4f1f1', fontWeight: '600', fontFamily: 'monospace' }}>
                            {formatCurrency((item.unit_price_cents || 0) * (item.quantity || 1))}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #404040' }}>
                      <td colSpan="4" style={{ textAlign: 'right', padding: '12px 8px', color: '#94a3b8', fontWeight: '600' }}>
                        Gesamtsumme:
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', color: '#0891b2', fontWeight: '700', fontSize: '16px', fontFamily: 'monospace' }}>
                        {formatCurrency(order.total_amount_cents || order.totalCents || order.total_cents || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div style={{ padding: '12px', background: '#7c2d12', borderRadius: '6px' }}>
                <strong style={{ color: '#fed7aa' }}>⚠️ Keine Items vorhanden</strong>
                <p style={{ color: '#fed7aa', fontSize: '13px', margin: '4px 0 0 0' }}>
                  Diese Bestellung hat keine Items-Daten. Möglicherweise vor Migration erstellt.
                </p>
              </div>
            )}
          </div>

          {/* Configuration (if configurator order) */}
          {(() => {
            // ✅ PRIORITY: configJson (Prisma camelCase) > config_json (legacy) > items[0].config
            const configSource = order.configJson || order.config_json || order.items?.[0]?.config || order.items_json?.[0]?.config;
            const hasConfig = configSource || order.configuration_id;
            
            console.log('[RENDER] configSource:', configSource);
            console.log('[RENDER] hasConfig:', hasConfig);
            
            if (!hasConfig) return null;
            
            return (
              <div className="info-card">
                <h2>🎨 Konfigurator-Konfiguration</h2>
                
                {configSource ? (
                  <>
                    <div className="config-preview" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '16px'
                    }}>
                      {(() => {
                        const configObj = typeof configSource === 'string' ? JSON.parse(configSource) : configSource;
                      
                      return (
                        <>
                          {configObj.variant && (
                            <div className="config-item">
                              <strong style={{ color: '#94a3b8', fontSize: '12px' }}>Variant</strong>
                              <div style={{ color: '#d4f1f1', marginTop: '4px', textTransform: 'capitalize' }}>
                                {configObj.variant}
                              </div>
                            </div>
                          )}
                          
                          {configObj?.colors && (
                            <div className="config-item" style={{ gridColumn: '1 / -1' }}>
                              <strong style={{ color: '#94a3b8', fontSize: '12px' }}>
                                🎨 {configObj.variant === 'bottle_holder' ? '2-Part' : '4-Part'} Color Configuration
                              </strong>
                              <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                                {(() => {
                                  // Determine parts based on variant
                                  const parts = configObj.variant === 'bottle_holder' 
                                    ? ['base', 'pattern']  // 2-part for bottle_holder
                                    : ['base', 'arm', 'module', 'pattern'];  // 4-part for glass_holder
                                  
                                  console.log('[COLOR RENDER] parts:', parts, 'colors:', configObj.colors);
                                  
                                  return Array.isArray(parts) ? parts.map((part) => {
                                    const colorId = configObj.colors[part];
                                    if (!colorId) return null;
                                  
                                  return (
                                    <div key={part} style={{
                                      background: '#1a1a1a',
                                      padding: '12px',
                                      borderRadius: '6px',
                                      border: '1px solid #404040'
                                    }}>
                                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '600' }}>
                                        {part}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                          width: '32px',
                                          height: '32px',
                                          borderRadius: '6px',
                                          background: getColorHex(colorId),
                                          border: '2px solid #404040',
                                          flexShrink: 0
                                        }}></div>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ color: '#d4f1f1', fontSize: '13px', fontWeight: '500' }}>
                                            {getColorDisplayName(colorId)}
                                          </div>
                                          <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                                            {colorId}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }) : null;
                                })()}
                              </div>
                            </div>
                          )}
                          
                          {configObj.color && !configObj.colors && (
                            <div className="config-item" style={{ gridColumn: '1 / -1' }}>
                              <div style={{
                                background: '#854d0e',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid #a16207'
                              }}>
                                <strong style={{ color: '#fef3c7', fontSize: '12px' }}>
                                  ⚠️ Legacy Order – Single Color Only
                                </strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                  <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    background: configObj.color,
                                    border: '2px solid #404040'
                                  }}></div>
                                  <span style={{ color: '#fef3c7', textTransform: 'capitalize' }}>
                                    {configObj.color}
                                  </span>
                                </div>
                                <p style={{ color: '#fef3c7', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
                                  Diese Bestellung wurde vor Migration 013 (4-part colors) erstellt.
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {configObj.finish && (
                            <div className="config-item">
                              <strong style={{ color: '#94a3b8', fontSize: '12px' }}>Finish</strong>
                              <div style={{ color: '#d4f1f1', marginTop: '4px', textTransform: 'capitalize' }}>
                                {configObj.finish}
                              </div>
                            </div>
                          )}
                          
                          {configObj.product_variant && (
                            <div className="config-item">
                              <strong style={{ color: '#94a3b8', fontSize: '12px' }}>Variante</strong>
                              <div style={{ color: '#d4f1f1', marginTop: '4px' }}>
                                {configObj.product_variant}
                              </div>
                            </div>
                          )}
                          
                          {configObj.product_name && (
                            <div className="config-item">
                              <strong style={{ color: '#94a3b8', fontSize: '12px' }}>Produkt</strong>
                              <div style={{ color: '#d4f1f1', marginTop: '4px' }}>
                                {configObj.product_name}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  
                  {(order.preview_image_url || order.previewImageUrl) && (
                    <div className="config-preview-image" style={{ marginBottom: '16px' }}>
                      <strong style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                        Vorschau
                      </strong>
                      <img 
                        src={order.preview_image_url || order.previewImageUrl} 
                        alt="Configuration Preview" 
                        style={{
                          maxWidth: '300px',
                          borderRadius: '8px',
                          border: '1px solid #404040'
                        }}
                      />
                    </div>
                  )}
                  
                  <details style={{ marginTop: '16px' }}>
                    <summary style={{ 
                      cursor: 'pointer', 
                      color: '#0891b2',
                      padding: '8px',
                      background: '#1a1a1a',
                      borderRadius: '4px',
                      userSelect: 'none'
                    }}>
                      📄 Vollständige Konfiguration (JSON)
                    </summary>
                    <div style={{ marginTop: '8px' }}>
                      <button
                        onClick={() => {
                          const jsonStr = typeof configSource === 'string' ? configSource : JSON.stringify(configSource, null, 2);
                          navigator.clipboard.writeText(jsonStr);
                          alert('Konfiguration in Zwischenablage kopiert!');
                        }}
                        style={{
                          background: '#0891b2',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          marginBottom: '8px'
                        }}
                      >
                        📋 JSON kopieren
                      </button>
                      <pre style={{
                        background: '#1a1a1a',
                        padding: '12px',
                        borderRadius: '6px',
                        overflow: 'auto',
                        fontSize: '12px',
                        color: '#d4f1f1',
                        border: '1px solid #404040'
                      }}>
                        {typeof configSource === 'string' 
                          ? configSource
                          : JSON.stringify(configSource, null, 2)
                        }
                      </pre>
                    </div>
                  </details>
                </>
              ) : (
                <div style={{ padding: '12px', background: '#7c2d12', borderRadius: '6px' }}>
                  <strong style={{ color: '#fed7aa' }}>⚠️ Konfiguration fehlt</strong>
                  <p style={{ color: '#fed7aa', fontSize: '13px', margin: '4px 0 0 0' }}>
                    Diese Bestellung hat configuration_id aber keine config_json/items.config Daten.
                  </p>
                </div>
              )}
              </div>
            );
          })()}

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="info-card">
              <h2>Lieferadresse</h2>
              <div className="address">
                {order.shippingAddress.line1}<br />
                {order.shippingAddress.line2 && <>{order.shippingAddress.line2}<br /></>}
                {order.shippingAddress.postal_code} {order.shippingAddress.city}<br />
                {order.shippingAddress.state && <>{order.shippingAddress.state}<br /></>}
                {order.shippingAddress.country}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="info-card">
            <h2>Artikel</h2>
            <table className="items-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>SKU</th>
                  <th>Menge</th>
                  <th>Einzelpreis</th>
                  <th>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.variant && <div className="item-variant">{item.variant}</div>}
                    </td>
                    <td>{item.sku || '—'}</td>
                    <td>{item.qty}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="info-card">
            <h2>Summen</h2>
            <div className="totals">
              <div className="total-row">
                <span>Zwischensumme:</span>
                <span>{formatCurrency(order.amountTotal - order.amountShipping - order.amountTax)}</span>
              </div>
              <div className="total-row">
                <span>Versand:</span>
                <span>{formatCurrency(order.amountShipping)}</span>
              </div>
              <div className="total-row">
                <span>MwSt.:</span>
                <span>{formatCurrency(order.amountTax)}</span>
              </div>
              <div className="total-row total">
                <span>Gesamt:</span>
                <span>{formatCurrency(order.amountTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="info-card">
            <h2>Zahlungsdetails</h2>
            <div className="info-grid">
              <div>
                <strong>Stripe-Sitzung:</strong>
                <span className="mono">{order.stripeCheckoutSessionId}</span>
              </div>
              {order.stripePaymentIntentId && (
                <div>
                  <strong>Zahlungs-ID:</strong>
                  <span className="mono">{order.stripePaymentIntentId}</span>
                </div>
              )}
              {order.paidAt && (
                <div>
                  <strong>Bezahlt am:</strong>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}
              <div>
                <strong>Erstellt am:</strong>
                <span>{formatDate(order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Order Events */}
          {order.events && order.events.length > 0 && (
            <div className="info-card">
              <h2>Aktivitätsprotokoll</h2>
              <div className="events">
                {order.events.map((event) => (
                  <div key={event.id} className="event">
                    <div className="event-header">
                      <span className="event-type">{event.type}</span>
                      <span className="event-time">{formatDate(event.createdAt)}</span>
                    </div>
                    <div className="event-source">Quelle: {event.source}</div>
                    {event.payload && (
                      <details className="event-payload">
                        <summary>Details anzeigen</summary>
                        <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="info-card">
            <h2>Interne Notizen</h2>
            <textarea
              placeholder="Notizen zu dieser Bestellung hinzufügen..."
              value={order.notes || ''}
              onChange={(e) => updateStatus('notes', e.target.value)}
              disabled={updating}
              rows={4}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .order-detail {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: 32px;
        }

        .back-btn {
          background: #0a4d4d;
          color: #d4f1f1;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 16px;
          transition: background 0.2s;
        }

        .back-btn:hover {
          background: #0d6666;
        }

        .title-section h1 {
          color: #d4f1f1;
          margin: 0 0 8px 0;
        }

        .order-id {
          color: #94a3b8;
          font-family: monospace;
          font-size: 14px;
        }

        .content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .status-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .status-card {
          background: #262626;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 20px;
        }

        .status-card label {
          display: block;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .status-card select {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #404040;
          color: #d4f1f1;
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .status-card select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .info-card {
          background: #262626;
          border: 1px solid #404040;
          border-radius: 8px;
          padding: 24px;
        }

        .info-card h2 {
          color: #d4f1f1;
          font-size: 18px;
          margin: 0 0 16px 0;
          padding-bottom: 12px;
          border-bottom: 1px solid #404040;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .info-grid > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-grid strong {
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
        }

        .info-grid span {
          color: #d4f1f1;
          font-size: 14px;
        }

        .mono {
          font-family: monospace;
          font-size: 12px;
          word-break: break-all;
        }

        .address {
          color: #d4f1f1;
          line-height: 1.6;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
        }

        .items-table th {
          text-align: left;
          padding: 12px;
          background: #1a1a1a;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          border-bottom: 1px solid #404040;
        }

        .items-table td {
          padding: 12px;
          color: #d4f1f1;
          border-bottom: 1px solid #333;
        }

        .item-name {
          font-weight: 500;
        }

        .item-variant {
          color: #94a3b8;
          font-size: 13px;
          margin-top: 4px;
        }

        .totals {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 400px;
          margin-left: auto;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          color: #d4f1f1;
          padding: 8px 0;
        }

        .total-row.total {
          border-top: 2px solid #0a4d4d;
          margin-top: 8px;
          padding-top: 16px;
          font-size: 18px;
          font-weight: 600;
          color: #d4f1f1;
        }

        .events {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .event {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 12px;
        }

        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .event-type {
          background: #0a4d4d;
          color: #d4f1f1;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .event-time {
          color: #94a3b8;
          font-size: 13px;
        }

        .event-source {
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .event-payload summary {
          color: #0a4d4d;
          cursor: pointer;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .event-payload pre {
          background: #000;
          color: #22c55e;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          overflow-x: auto;
          margin: 0;
        }

        textarea {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #404040;
          color: #d4f1f1;
          padding: 12px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }

        textarea:disabled {
          opacity: 0.5;
        }

        .loading, .error-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }

        .error-state h2 {
          color: #ef4444;
          margin-bottom: 16px;
        }

        .error-state button {
          background: #0a4d4d;
          color: #d4f1f1;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 16px;
        }
      `}</style>
    </AdminLayout>
  );
}

export async function getServerSideProps(context) {
  return { props: {} };
}
