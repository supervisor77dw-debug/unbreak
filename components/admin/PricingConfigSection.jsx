import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CONFIGURATOR_COLORS } from '../../lib/constants/colors';
import { PART_LABELS } from '../../lib/constants/parts';
import { parseEuroToCents, formatCentsToEuro } from '../../lib/utils/currency';

export default function PricingConfigSection() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeVariant, setActiveVariant] = useState('glass_holder');
  const [configs, setConfigs] = useState({
    glass_holder: null,
    bottle_holder: null,
  });
  const [editedConfig, setEditedConfig] = useState(null);
  const [message, setMessage] = useState(null);

  // Wait for session before fetching
  useEffect(() => {
    if (status === 'loading') return; // Wait for session to load
    if (!session) {
      setMessage({ type: 'error', text: '⚠️ Nicht angemeldet. Bitte neu einloggen.' });
      return;
    }
    fetchConfigs();
  }, [session, status]);

  useEffect(() => {
    if (configs[activeVariant]) {
      setEditedConfig({ ...configs[activeVariant] });
    }
  }, [activeVariant, configs]);

  async function fetchConfigs() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pricing');
      if (!res.ok) throw new Error('Failed to fetch configs');
      const data = await res.json();
      
      setConfigs({
        glass_holder: data.glass_holder || null,
        bottle_holder: data.bottle_holder || null,
      });
      
      setEditedConfig(data[activeVariant] || null);
    } catch (error) {
      console.error('Error fetching configs:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Konfiguration' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    // Check session before saving
    if (!session) {
      setMessage({ type: 'error', text: '⚠️ Session abgelaufen. Bitte Seite neu laden und erneut anmelden.' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: activeVariant,
          config: editedConfig,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Session abgelaufen - bitte neu anmelden');
        }
        throw new Error('Failed to save');
      }

      setMessage({ type: 'success', text: '✅ Gespeichert! Neue Bestellungen verwenden diese Preise.' });
      await fetchConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: '❌ Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  }

  function updateColorPrice(part, colorId, value) {
    const cents = parseEuroToCents(value);
    setEditedConfig(prev => ({
      ...prev,
      color_prices: {
        ...prev.color_prices,
        [part]: {
          ...prev.color_prices[part],
          [colorId]: cents,
        },
      },
    }));
  }

  function updateBasePrice(value) {
    const cents = parseEuroToCents(value);
    setEditedConfig(prev => ({
      ...prev,
      base_price_cents: cents,
    }));
  }

  if (loading) {
    return <div style={{ padding: '16px', color: '#94a3b8' }}>Laden...</div>;
  }

  const glassHolderParts = ['base', 'arm', 'module', 'pattern'];
  const bottleHolderParts = ['pattern']; // Nur Muster hat Aufschläge

  return (
    <div style={{ marginTop: '48px', paddingTop: '48px', borderTop: '2px solid #2a2a2a' }}>
      <h2 style={{ fontSize: '24px', color: '#d4f1f1', marginBottom: '24px' }}>
        ⚙️ Pricing-Konfiguration
      </h2>

      {/* Info Box */}
      <div style={{
        padding: '12px 16px',
        marginBottom: '20px',
        borderRadius: '6px',
        background: '#1e3a8a',
        color: '#bfdbfe',
        border: '1px solid #3b82f6',
        fontSize: '13px',
      }}>
        💡 <strong>Snapshot-Prinzip:</strong> Preisänderungen wirken NICHT rückwirkend. Alte Bestellungen behalten ihre Preise.
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '6px',
          background: message.type === 'success' ? '#064e3b' : '#7c2d12',
          color: message.type === 'success' ? '#86efac' : '#fecaca',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#dc2626'}`,
          fontSize: '14px',
        }}>
          {message.text}
        </div>
      )}

      {/* Variant Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveVariant('glass_holder')}
          style={{
            padding: '10px 20px',
            background: activeVariant === 'glass_holder' ? '#0891b2' : '#1a1a1a',
            color: 'white',
            border: activeVariant === 'glass_holder' ? '2px solid #06b6d4' : '2px solid #404040',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          🍷 Glashalter
        </button>
        <button
          onClick={() => setActiveVariant('bottle_holder')}
          style={{
            padding: '10px 20px',
            background: activeVariant === 'bottle_holder' ? '#0891b2' : '#1a1a1a',
            color: 'white',
            border: activeVariant === 'bottle_holder' ? '2px solid #06b6d4' : '2px solid #404040',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          🍾 Flaschenhalter
        </button>
      </div>

      {editedConfig && (
        <>
          {/* Base Price */}
          <div style={{
            background: '#1a1a1a',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #404040',
          }}>
            <h3 style={{ color: '#0891b2', fontSize: '16px', marginBottom: '12px', fontWeight: '600' }}>
              💰 Basispreis
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="text"
                value={formatCentsToEuro(editedConfig.base_price_cents || 0)}
                onChange={(e) => updateBasePrice(e.target.value)}
                placeholder="0,00"
                style={{
                  padding: '10px',
                  fontSize: '16px',
                  width: '130px',
                  background: '#0a0a0a',
                  color: '#d4f1f1',
                  border: '2px solid #404040',
                  borderRadius: '6px',
                }}
              />
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>€</span>
            </div>
          </div>

          {/* Glashalter: Color Upcharges for 4 parts */}
          {activeVariant === 'glass_holder' && (
            <div style={{
              background: '#1a1a1a',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #404040',
            }}>
              <h3 style={{ color: '#0891b2', fontSize: '16px', marginBottom: '16px', fontWeight: '600' }}>
                🎨 Farb-Aufschläge (7 Farben)
              </h3>
              
              {glassHolderParts.map(part => (
                <div key={part} style={{ marginBottom: '24px' }}>
                  <h4 style={{ 
                    color: '#94a3b8', 
                    fontSize: '14px', 
                    marginBottom: '12px',
                    fontWeight: '600',
                  }}>
                    {PART_LABELS[part]}
                  </h4>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px',
                  }}>
                    {CONFIGURATOR_COLORS.map(color => (
                      <div key={color.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: color.hex,
                          border: '1px solid #404040',
                          flexShrink: 0,
                        }} />
                        <span style={{ 
                          color: '#cbd5e1', 
                          fontSize: '13px',
                          width: '80px',
                          flexShrink: 0,
                        }}>
                          {color.name}
                        </span>
                        <input
                          type="text"
                          value={formatCentsToEuro(editedConfig.color_prices?.[part]?.[color.id] || 0)}
                          onChange={(e) => updateColorPrice(part, color.id, e.target.value)}
                          placeholder="0,00"
                          style={{
                            padding: '6px 8px',
                            fontSize: '13px',
                            width: '70px',
                            background: '#0a0a0a',
                            color: '#d4f1f1',
                            border: '1px solid #404040',
                            borderRadius: '4px',
                          }}
                        />
                        <span style={{ color: '#64748b', fontSize: '12px' }}>€</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flaschenhalter: Only pattern upcharges */}
          {activeVariant === 'bottle_holder' && (
            <div style={{
              background: '#1a1a1a',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #404040',
            }}>
              <h3 style={{ color: '#0891b2', fontSize: '16px', marginBottom: '16px', fontWeight: '600' }}>
                🎨 {PART_LABELS.pattern}-Aufschläge (7 Farben)
              </h3>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
              }}>
                {CONFIGURATOR_COLORS.map(color => (
                  <div key={color.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      background: color.hex,
                      border: '1px solid #404040',
                      flexShrink: 0,
                    }} />
                    <span style={{ 
                      color: '#cbd5e1', 
                      fontSize: '13px',
                      width: '80px',
                      flexShrink: 0,
                    }}>
                      {color.name}
                    </span>
                    <input
                      type="text"
                      value={formatCentsToEuro(editedConfig.color_prices?.pattern?.[color.id] || 0)}
                      onChange={(e) => updateColorPrice('pattern', color.id, e.target.value)}
                      placeholder="0,00"
                      style={{
                        padding: '6px 8px',
                        fontSize: '13px',
                        width: '70px',
                        background: '#0a0a0a',
                        color: '#d4f1f1',
                        border: '1px solid #404040',
                        borderRadius: '4px',
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>€</span>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: '#0a0a0a',
                borderRadius: '6px',
                border: '1px solid #334155',
              }}>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                  ℹ️ <strong>Flaschenhalter</strong> besteht aus Grundplatte (Basispreis) + Muster (Aufschlag).
                  <br />Keine Arm-/Gummilippen-Auswahl.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: saving ? '#404040' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              {saving ? 'Speichert...' : '💾 Speichern'}
            </button>
            <button
              onClick={() => setEditedConfig({ ...configs[activeVariant] })}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: '#1a1a1a',
                color: '#94a3b8',
                border: '2px solid #404040',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              ↺ Zurücksetzen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
