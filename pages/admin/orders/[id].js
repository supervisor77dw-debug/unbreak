import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AdminLayout from '../../../components/AdminLayout';
import { getColorHex, getColorDisplayName } from '../../../lib/configValidation';
import { getPricingBreakdown, formatCurrency as formatPrice } from '../../../lib/utils/priceCalculator';

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [debugExpanded, setDebugExpanded] = useState(false); // 🔥 MESSE-FIX: Collapsible debug

  useEffect(() => {
    if (status === 'unauthenticated') {
      // Redirect to login with callback URL to return here after login
      const callbackUrl = encodeURIComponent(router.asPath);
      router.push(`/admin/login?callbackUrl=${callbackUrl}`);
    }
  }, [status, router]);

  useEffect(() => {
    // Wait for session to be fully loaded
    if (!id) return;
    if (status === 'loading') return;
    
    // If not authenticated, redirect
    if (status === 'unauthenticated') {
      const callbackUrl = encodeURIComponent(router.asPath);
      router.push(`/admin/login?callbackUrl=${callbackUrl}`);
      return;
    }
    
    // Only fetch when authenticated with active session
    if (status !== 'authenticated' || !session) return;
    
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/admin/orders/${id}`);
        
        // Handle different error types
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'UNKNOWN' }));
          
          if (res.status === 401 || errorData.error === 'UNAUTHORIZED') {
            const callbackUrl = encodeURIComponent(router.asPath);
            router.push(`/admin/login?callbackUrl=${callbackUrl}`);
            return;
          }
          
          if (res.status === 404) {
            if (errorData.error === 'NOT_FOUND') {
              throw new Error('Bestellung nicht gefunden');
            } else {
              // 404 without NOT_FOUND might be auth issue
              const callbackUrl = encodeURIComponent(router.asPath);
              router.push(`/admin/login?callbackUrl=${callbackUrl}`);
              return;
            }
          }
          
          throw new Error(`Failed to fetch order: ${res.status}`);
        }
        const data = await res.json();
        
        setOrder(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
  }, [id, status, session, router]);

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
        <div className="loading">
          {status === 'loading' ? 'Authentifizierung wird geprüft...' : 'Bestellung wird geladen...'}
        </div>
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
    if (cents == null || isNaN(cents)) return '€0,00';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: order.currency || 'EUR',
    }).format(cents / 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  // Render legacy items (fallback for orders without pricing snapshot)
  const renderLegacyItems = (items) => {
    const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
    
    // 🔥 MESSE-FIX: Get pricing breakdown (calculate Netto/MwSt from Brutto)
    const pricing = getPricingBreakdown(order);
    
    return (
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
            {itemsArray.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ color: '#d4f1f1', fontWeight: '500' }}>
                    {item?.name || item?.product_name || 'Produkt'}
                  </div>
                  {item?.config && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {item?.config?.colors && (
                        <span>🎨 {Object.entries(item.config.colors).map(([area, color]) => `${area}: ${color}`).join(', ')}</span>
                      )}
                      {item?.config?.finish && <span> • {item.config.finish}</span>}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                  <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', color: '#0891b2' }}>
                    {item.sku || item.product_sku || '—'}
                  </code>
                </td>
                <td style={{ textAlign: 'center', padding: '12px 8px', color: '#d4f1f1' }}>
                  {item?.quantity || 1}
                </td>
                <td style={{ textAlign: 'right', padding: '12px 8px', color: '#d4f1f1', fontFamily: 'monospace' }}>
                  {formatCurrency(item?.unitPrice || item?.unit_price_cents || 0)}
                </td>
                <td style={{ textAlign: 'right', padding: '12px 8px', color: '#d4f1f1', fontWeight: '600', fontFamily: 'monospace' }}>
                  {formatCurrency((item?.unitPrice || item?.unit_price_cents || 0) * (item?.quantity || 1))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* 🔥 MESSE-FIX: Show Netto/MwSt breakdown (calculated from Brutto) */}
            {pricing.totalBrutto > 0 && (
              <>
                {/* Zwischensumme Netto */}
                <tr style={{ borderTop: '1px solid #2a2a2a' }}>
                  <td colSpan="4" style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>
                    Zwischensumme (Netto):
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', color: '#d4f1f1' }}>
                    {formatPrice(pricing.subtotalNetto, pricing.currency)}
                  </td>
                </tr>
                
                {/* Versand (if available) */}
                {pricing.shippingBrutto > 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>
                      Versand (Netto):
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', color: '#d4f1f1' }}>
                      {formatPrice(pricing.shippingNetto, pricing.currency)}
                    </td>
                  </tr>
                )}
                
                {/* MwSt */}
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>
                    MwSt. ({Math.round(pricing.vatRate * 100)}% inkl.):
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', color: '#94a3b8' }}>
                    {formatPrice(pricing.totalVat, pricing.currency)}
                  </td>
                </tr>
                
                {/* Grand Total */}
                <tr style={{ borderTop: '2px solid #404040' }}>
                  <td colSpan="4" style={{ textAlign: 'right', padding: '12px 8px', color: '#94a3b8', fontWeight: '600' }}>
                    Gesamtsumme (Brutto):
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '12px 8px', 
                    color: '#0891b2', 
                    fontWeight: '700', 
                    fontSize: '16px', 
                    fontFamily: 'monospace' 
                  }}>
                    {formatPrice(pricing.totalBrutto, pricing.currency)}
                  </td>
                </tr>
                
                {/* Calculation hint for non-snapshot orders */}
                {!pricing.hasSnapshot && (
                  <tr>
                    <td colSpan="5" style={{ padding: '8px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                      ℹ️ Netto/MwSt berechnet aus Gesamtbetrag (Standard-MwSt {Math.round(pricing.vatRate * 100)}%)
                    </td>
                  </tr>
                )}
              </>
            )}
          </tfoot>
        </table>
      </div>
    );
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
            <div className="order-id">
              {order.order_number ? (
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0891b2' }}>
                  {order.order_number}
                </span>
              ) : (
                <span>ID: {order.id.substring(0, 8)}...</span>
              )}
            </div>
          </div>
        </div>

        <div className="content">
          {/* 🆔 ORDER IDENTIFIERS DEBUG PANEL - COLLAPSIBLE */}
          {order._debug && (
            <div className="info-card" style={{ background: '#1a1a1a', borderLeft: '4px solid #0891b2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0 }}>🔍 Bestellnummern & IDs</h2>
                <button 
                  onClick={() => setDebugExpanded(!debugExpanded)}
                  style={{
                    background: debugExpanded ? '#334155' : '#0891b2',
                    border: 'none',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {debugExpanded ? '▼ Einklappen' : '▶ Debug-Details anzeigen'}
                </button>
              </div>
              
              {/* COLLAPSED: Show only essential info */}
              {!debugExpanded && (
                <div className="info-grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Bestellnummer:</strong>
                    <span style={{ 
                      fontSize: '18px', 
                      color: '#0891b2', 
                      fontWeight: 'bold', 
                      fontFamily: 'monospace',
                      marginLeft: '12px'
                    }}>
                      {order._debug.order_number}
                    </span>
                  </div>
                  {order._debug.stripe_session_id !== '(not set)' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Stripe Session:</strong>
                      <span className="mono" style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '12px' }}>
                        {order._debug.stripe_session_id.substring(0, 40)}...
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* EXPANDED: Show all debug info */}
              {debugExpanded && (
                <div className="info-grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Bestellnummer (Order Number):</strong>
                    <div style={{ 
                      fontSize: '20px', 
                      color: '#0891b2', 
                      fontWeight: 'bold', 
                      fontFamily: 'monospace',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {order._debug.order_number}
                      <button 
                        onClick={() => navigator.clipboard.writeText(order._debug.order_number)}
                        style={{
                          background: '#0891b2',
                          border: 'none',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        📋 Kopieren
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <strong>UUID (Primäre ID):</strong>
                    <div style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '11px', 
                      color: '#94a3b8',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ wordBreak: 'break-all' }}>{order._debug.uuid}</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(order._debug.uuid)}
                        style={{
                          background: '#334155',
                          border: 'none',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '10px',
                          flexShrink: 0
                        }}
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div>
                    <strong>Public ID (Kurz-ID):</strong>
                    <span className="mono" style={{ color: '#0891b2' }}>{order._debug.public_id}</span>
                  </div>

                  <div>
                    <strong>Stripe Session ID:</strong>
                    <span className="mono" style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all' }}>
                      {order._debug.stripe_session_id}
                    </span>
                  </div>

                  <div>
                    <strong>Stripe Payment Intent:</strong>
                    <span className="mono" style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all' }}>
                      {order._debug.stripe_payment_intent}
                    </span>
                  </div>

                  <div>
                    <strong>Trace ID:</strong>
                    <span className="mono" style={{ fontSize: '11px', color: order._debug.trace_id !== '(not set)' ? '#10b981' : '#ef4444' }}>
                      {order._debug.trace_id}
                    </span>
                  </div>

                  <div>
                    <strong>Snapshot ID:</strong>
                    <span className="mono" style={{ fontSize: '11px', color: order._debug.snapshot_id !== '(not set)' ? '#10b981' : '#ef4444' }}>
                      {order._debug.snapshot_id}
                    </span>
                  </div>

                  <div>
                    <strong>Pricing Snapshot:</strong>
                    <span style={{ 
                      color: order._debug.has_snapshot ? '#10b981' : '#ef4444',
                      fontWeight: 'bold'
                    }}>
                      {order._debug.has_snapshot ? '✅ Vorhanden' : '❌ Fehlt'}
                    </span>
                  </div>

                  {order._debug.customer_id !== '(not set)' && (
                    <div>
                      <strong>Customer ID (DB):</strong>
                      <span className="mono" style={{ fontSize: '11px' }}>{order._debug.customer_id}</span>
                    </div>
                  )}

                  <div>
                    <strong>Erstellt:</strong>
                    <span>{formatDate(order._debug.created_at)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

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
              {/* 🔥 MESSE-FIX: Improved customer linking warning */}
              {!order.customer && !order.customer_id && (
                <div style={{ gridColumn: '1 / -1', padding: '12px', background: '#854d0e', borderRadius: '6px' }}>
                  <strong style={{ color: '#fef3c7' }}>⚠️ Customer-Verknüpfung fehlt</strong>
                  <p style={{ color: '#fef3c7', fontSize: '13px', margin: '4px 0 0 0' }}>
                    {(order.stripe_customer_id || order.stripeCustomerId) ? (
                      <>Stripe Customer ID vorhanden, aber customer_id nicht gesetzt. Automatische Verknüpfung läuft beim nächsten Laden.</>
                    ) : (
                      <>Weder Stripe Customer ID noch E-Mail-Match gefunden. Bitte Bestellung und Customer manuell prüfen.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items - Display from Pricing Snapshot ONLY */}
          <div className="info-card">
            <h2>📦 Bestellte Produkte</h2>
            {(() => {
              // 🚨 CRITICAL: Use pricing_snapshot as SINGLE SOURCE OF TRUTH
              // Backend does NOT calculate prices - only displays snapshot
              // Try multiple sources (fallback chain):
              // 1. price_breakdown_json (dedicated column)
              // 2. metadata.pricing_snapshot (legacy location)
              const snapshot = order.price_breakdown_json || 
                              order.priceBreakdownJson || 
                              order.metadata?.pricing_snapshot;
              
              // Determine if order is truly legacy (created before snapshot system)
              const SNAPSHOT_ROLLOUT_DATE = new Date('2026-01-12'); // Date snapshot system was deployed
              const orderDate = new Date(order.created_at || order.createdAt);
              const isOldOrder = orderDate < SNAPSHOT_ROLLOUT_DATE;
              
              if (!snapshot || !snapshot.items || snapshot.items.length === 0) {
                // NO SNAPSHOT FOUND - Show simplified view
                const legacyItems = order.items || order.items_json;
                if (!legacyItems || legacyItems.length === 0) {
                  return (
                    <div style={{ padding: '12px', background: '#7c2d12', borderRadius: '6px' }}>
                      <strong style={{ color: '#fed7aa' }}>⚠️ Keine Items vorhanden</strong>
                      <p style={{ color: '#fed7aa', fontSize: '13px', margin: '4px 0 0 0' }}>
                        Diese Bestellung hat keine Items-Daten. Möglicherweise vor Migration erstellt.
                      </p>
                    </div>
                  );
                }
                
                // Determine if order is truly legacy (created before snapshot system)
                const SNAPSHOT_ROLLOUT_DATE = new Date('2026-01-12');
                const orderDate = new Date(order.created_at || order.createdAt);
                const isOldOrder = orderDate < SNAPSHOT_ROLLOUT_DATE;
                
                // 🔥 MESSE-FIX: Only show "Legacy" warning for truly old orders
                // UO-orders without snapshots are ERRORS, not legacy
                const isUnbreakOrder = order.order_number?.startsWith('UO-');
                
                if (!isUnbreakOrder && isOldOrder) {
                  // TRUE LEGACY ORDER - before snapshot system, not Unbreak-One
                  return (
                    <div>
                      <div style={{ padding: '12px', background: '#854d0e', borderRadius: '6px', marginBottom: '16px' }}>
                        <strong style={{ color: '#fef3c7' }}>⚠️ Legacy-Bestellung (kein Pricing Snapshot)</strong>
                        <p style={{ color: '#fef3c7', fontSize: '13px', margin: '4px 0 0 0' }}>
                          Diese Bestellung wurde vor Einführung des Pricing Snapshot Systems erstellt ({orderDate.toLocaleDateString('de-DE')}).
                        </p>
                      </div>
                      {renderLegacyItems(legacyItems)}
                    </div>
                  );
                } else if (isUnbreakOrder) {
                  // 🔥 UO-ORDER WITHOUT SNAPSHOT - This is acceptable for simple products
                  return (
                    <div>
                      {renderLegacyItems(legacyItems)}
                    </div>
                  );
                } else {
                  // NEW ORDER WITHOUT SNAPSHOT - THIS IS A BUG!
                  return (
                    <div>
                      <div style={{ padding: '12px', background: '#7c2d12', borderRadius: '6px', marginBottom: '16px' }}>
                        <strong style={{ color: '#fed7aa' }}>🚨 FEHLER: Pricing Snapshot fehlt!</strong>
                        <p style={{ color: '#fed7aa', fontSize: '13px', margin: '4px 0 0 0' }}>
                          Diese neue Bestellung ({orderDate.toLocaleDateString('de-DE')}) sollte einen Pricing Snapshot haben, hat aber keinen.
                          Dies ist ein Systemfehler. Bitte Trace ID {order.trace_id || order.metadata?.trace_id || 'N/A'} in Logs prüfen.
                        </p>
                        <p style={{ color: '#fed7aa', fontSize: '12px', margin: '8px 0 0 0', fontFamily: 'monospace' }}>
                          Order ID: {order.id}<br/>
                          Trace ID: {order.trace_id || order.metadata?.trace_id || 'N/A'}<br/>
                          Snapshot ID: {order.snapshot_id || order.metadata?.snapshot_id || 'N/A'}
                        </p>
                      </div>
                      {renderLegacyItems(legacyItems)}
                    </div>
                  );
                }
              }
              
              // ✅ DISPLAY SNAPSHOT (SINGLE SOURCE OF TRUTH)
              return (
                <div>
                  {/* Snapshot Metadata */}
                  <div style={{ 
                    padding: '8px 12px', 
                    background: '#134e4a', 
                    borderRadius: '6px', 
                    marginBottom: '12px',
                    fontSize: '11px',
                    color: '#5eead4',
                    fontFamily: 'monospace'
                  }}>
                    ✅ Pricing Snapshot v{snapshot.snapshot_version || '1.0'} • 
                    Source: {snapshot.pricing_source || 'unknown'} • 
                    Calculated: {snapshot.calculated_at ? new Date(snapshot.calculated_at).toLocaleString('de-DE') : 'unknown'}
                  </div>
                  
                  {/* Items Table */}
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
                        {snapshot.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                            <td style={{ padding: '12px 8px' }}>
                              <div style={{ color: '#d4f1f1', fontWeight: '500' }}>
                                {item.name}
                              </div>
                              
                              {/* Configuration Display */}
                              {item.is_configurator && item.config && (
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                                  {item.config.colors && (
                                    <div>
                                      🎨 {Object.entries(item.config.colors).map(([area, color]) => {
                                        const displayName = getColorDisplayName(color);
                                        return `${area}: ${displayName}`;
                                      }).join(' • ')}
                                    </div>
                                  )}
                                  {item.config.finish && (
                                    <div>✨ Finish: {item.config.finish}</div>
                                  )}
                                  
                                  {/* Pricing Breakdown from Snapshot */}
                                  {item.pricing_breakdown && (
                                    <div style={{ 
                                      marginTop: '8px', 
                                      padding: '8px', 
                                      background: '#1a1a1a', 
                                      borderRadius: '4px', 
                                      borderLeft: '2px solid #0891b2' 
                                    }}>
                                      <div style={{ color: '#0891b2', fontWeight: '600', marginBottom: '4px', fontSize: '11px' }}>
                                        💰 PRICING BREAKDOWN (Snapshot v{item.pricing_breakdown.pricing_version || 'N/A'})
                                      </div>
                                      <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
                                        <div>Basis: {formatCurrency(item.pricing_breakdown.admin_base_price_cents || 0)}</div>
                                        {item.pricing_breakdown.option_prices_cents?.base > 0 && (
                                          <div style={{ color: '#fbbf24' }}>+ Base-Farbe: {formatCurrency(item.pricing_breakdown.option_prices_cents.base)}</div>
                                        )}
                                        {item.pricing_breakdown.option_prices_cents?.arm > 0 && (
                                          <div style={{ color: '#fbbf24' }}>+ Arm-Farbe: {formatCurrency(item.pricing_breakdown.option_prices_cents.arm)}</div>
                                        )}
                                        {item.pricing_breakdown.option_prices_cents?.module > 0 && (
                                          <div style={{ color: '#fbbf24' }}>+ Modul-Farbe: {formatCurrency(item.pricing_breakdown.option_prices_cents.module)}</div>
                                        )}
                                        {item.pricing_breakdown.option_prices_cents?.pattern > 0 && (
                                          <div style={{ color: '#fbbf24' }}>+ Pattern-Farbe: {formatCurrency(item.pricing_breakdown.option_prices_cents.pattern)}</div>
                                        )}
                                        {item.pricing_breakdown.option_prices_cents?.finish > 0 && (
                                          <div style={{ color: '#fbbf24' }}>+ Finish: {formatCurrency(item.pricing_breakdown.option_prices_cents.finish)}</div>
                                        )}
                                        {item.pricing_breakdown.custom_fee_cents > 0 && (
                                          <div style={{ color: '#fbbf24' }}>+ Custom Fee: {formatCurrency(item.pricing_breakdown.custom_fee_cents)}</div>
                                        )}
                                        <div style={{ 
                                          borderTop: '1px solid #404040', 
                                          marginTop: '4px', 
                                          paddingTop: '4px', 
                                          color: '#0891b2', 
                                          fontWeight: '600' 
                                        }}>
                                          = Subtotal: {formatCurrency(item.pricing_breakdown.computed_subtotal_cents || 0)}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                              <code style={{ 
                                background: '#1a1a1a', 
                                padding: '2px 6px', 
                                borderRadius: '3px', 
                                fontSize: '11px', 
                                color: '#0891b2' 
                              }}>
                                {item.sku || '—'}
                              </code>
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 8px', color: '#d4f1f1' }}>
                              {item.quantity}
                            </td>
                            <td style={{ textAlign: 'right', padding: '12px 8px', color: '#d4f1f1', fontFamily: 'monospace' }}>
                              {formatCurrency(item.unit_price_cents)}
                            </td>
                            <td style={{ textAlign: 'right', padding: '12px 8px', color: '#d4f1f1', fontWeight: '600', fontFamily: 'monospace' }}>
                              {formatCurrency(item.line_total_cents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {/* 🔥 MESSE-FIX: Show Netto/MwSt breakdown from snapshot */}
                        {(() => {
                          const pricing = getPricingBreakdown(order);
                          
                          return (
                            <>
                              {/* Zwischensumme Netto */}
                              <tr style={{ borderTop: '1px solid #2a2a2a' }}>
                                <td colSpan="4" style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>
                                  Zwischensumme (Netto):
                                </td>
                                <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', color: '#d4f1f1' }}>
                                  {formatPrice(pricing.subtotalNetto, pricing.currency)}
                                </td>
                              </tr>
                              
                              {/* Shipping Netto */}
                              {pricing.shippingBrutto > 0 && (
                                <tr>
                                  <td colSpan="4" style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>
                                    Versand (Netto, {snapshot.shipping_country || 'DE'}):
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', color: '#d4f1f1' }}>
                                    {formatPrice(pricing.shippingNetto, pricing.currency)}
                                  </td>
                                </tr>
                              )}
                              
                              {/* MwSt */}
                              <tr>
                                <td colSpan="4" style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>
                                  MwSt. ({Math.round(pricing.vatRate * 100)}% inkl.):
                                </td>
                                <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', color: '#94a3b8' }}>
                                  {formatPrice(pricing.totalVat, pricing.currency)}
                                </td>
                              </tr>
                              
                              {/* Grand Total */}
                              <tr style={{ borderTop: '2px solid #404040' }}>
                                <td colSpan="4" style={{ textAlign: 'right', padding: '12px 8px', color: '#94a3b8', fontWeight: '600' }}>
                                  Gesamtsumme (Brutto):
                                </td>
                                <td style={{ 
                                  textAlign: 'right', 
                                  padding: '12px 8px', 
                                  color: '#0891b2', 
                                  fontWeight: '700', 
                                  fontSize: '16px', 
                                  fontFamily: 'monospace' 
                                }}>
                                  {formatPrice(pricing.totalBrutto, pricing.currency)}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Configuration (if configurator order) */}
          {(() => {
            // ✅ PRIORITY: configJson (Prisma camelCase) > config_json (legacy) > items[0].config
            const configSource = order.configJson || order.config_json || order.items?.[0]?.config || order.items_json?.[0]?.config;
            const hasConfig = configSource || order.configuration_id;
            
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
              {(() => {
                // SINGLE SOURCE OF TRUTH: Use new fields if available, fallback to legacy
                const subtotalNet = order.subtotalNet || order.items?.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0) || 0;
                const shipping = order.amountShipping || 0;
                const taxAmount = order.taxAmount || 0;
                const totalGross = order.totalGross || (subtotalNet + taxAmount + shipping);
                const taxRate = order.taxRate || 0.19;
                
                return (
                  <>
                    <div className="total-row">
                      <span>Zwischensumme (Netto):</span>
                      <span>{formatCurrency(subtotalNet)}</span>
                    </div>
                    <div className="total-row">
                      <span>Versand (Netto){order.shippingRegion ? ` [${order.shippingRegion}]` : ''}:</span>
                      <span>{formatCurrency(shipping)}</span>
                    </div>
                    <div className="total-row">
                      <span>MwSt. ({(taxRate * 100).toFixed(0)}%):</span>
                      <span>{formatCurrency(taxAmount)}</span>
                    </div>
                    <div className="total-row total">
                      <span>Gesamt (Brutto):</span>
                      <span>{formatCurrency(totalGross)}</span>
                    </div>
                    {!order.subtotalNet && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#1e3a8a',
                        borderRadius: '6px',
                        border: '1px solid #3b82f6',
                        fontSize: '13px',
                        color: '#bfdbfe',
                      }}>
                        ℹ️ <strong>Legacy-Bestellung:</strong> MwSt-Ausweisung nicht verfügbar.
                      </div>
                    )}
                  </>
                );
              })()}
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
