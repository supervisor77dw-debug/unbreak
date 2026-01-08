import { useState, useEffect } from 'react';
import { CONFIGURATOR_COLORS } from '../../lib/constants/colors';

export default function PricingConfigSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeVariant, setActiveVariant] = useState('glass_holder');
  const [configs, setConfigs] = useState({
    glass_holder: null,
    bottle_holder: null,
  });
  const [editedConfig, setEditedConfig] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

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

      if (!res.ok) throw new Error('Failed to save');

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
    setEditedConfig(prev => ({
      ...prev,
      color_prices: {
        ...prev.color_prices,
        [part]: {
          ...prev.color_prices[part],
          [colorId]: parseInt(value) || 0,
        },
      },
    }));
  }

  if (loading) {
    return <div style={{ padding: '16px', color: '#94a3b8' }}>Laden...</div>;
  }

  return (
    <div style={{ marginTop: '48px', paddingTop: '48px', borderTop: '2px solid #2a2a2a' }}>
      <h2 style={{ fontSize: '24px', color: '#d4f1f1', marginBottom: '24px' }}>
        ⚙️ Pricing-Konfiguration
      </h2>

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
              Basispreis
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="number"
                value={editedConfig.base_price_cents || 0}
                onChange={(e) => setEditedConfig(prev => ({
                  ...prev,
                  base_price_cents: parseInt(e.target.value) || 0,
                }))}
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
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                Cent (= €{((editedConfig.base_price_cents || 0) / 100).toFixed(2)})
              </span>
            </div>
          </div>

          {/* Glashalter: Color Upcharges for all 4 parts */}
          {activeVariant === 'glass_holder' && (
            <div style={{
              background: '#1a1a1a',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #404040',
            }}>
              <h3 style={{ color: '#0891b2', fontSize: '16px', marginBottom: '16px', fontWeight: '600' }}>
                🎨 Farb-Aufschläge (7 Farben pro Teil)
              </h3>
              
              {['base', 'arm', 'module', 'pattern'].map(part => (
                <div key={part} style={{ marginBottom: '20px' }}>
                  <h4 style={{ 
                    color: '#94a3b8', 
                    fontSize: '13px', 
                    textTransform: 'uppercase', 
                    marginBottom: '10px',
                    fontWeight: '600',
                  }}>
                    {part === 'base' ? 'Basis' : part === 'arm' ? 'Arm' : part === 'module' ? 'Modul' : 'Pattern'}
                  </h4>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
                    gap: '10px' 
                  }}>
                    {CONFIGURATOR_COLORS.map(color => (
                      <div key={color.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#0a0a0a',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #404040',
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '3px',
                          background: color.hex,
                          border: '1px solid #404040',
                          flexShrink: 0,
                        }}></div>
                        <span style={{ 
                          color: '#d4f1f1', 
                          flex: 1, 
                          fontSize: '13px',
                        }}>
                          {color.name}
                        </span>
                        <input
                          type="number"
                          value={editedConfig.color_prices?.[part]?.[color.id] || 0}
                          onChange={(e) => updateColorPrice(part, color.id, e.target.value)}
                          style={{
                            width: '60px',
                            padding: '4px 6px',
                            background: '#000',
                            color: '#fbbf24',
                            border: '1px solid #404040',
                            borderRadius: '3px',
                            fontSize: '12px',
                            textAlign: 'right',
                          }}
                        />
                        <span style={{ color: '#64748b', fontSize: '11px' }}>¢</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flaschenhalter: Info */}
          {activeVariant === 'bottle_holder' && (
            <div style={{
              background: '#0c4a6e',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #0ea5e9',
            }}>
              <div style={{ color: '#7dd3fc', fontSize: '14px', marginBottom: '4px', fontWeight: '600' }}>
                ℹ️ Flaschenhalter-Konfiguration
              </div>
              <div style={{ color: '#bae6fd', fontSize: '13px' }}>
                Flaschenhalter verwendet aktuell nur den Basispreis. Farbaufschläge werden nicht angewendet.
              </div>
            </div>
          )}

          {/* Save Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
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
              {saving ? '💾 Speichern...' : '💾 Speichern'}
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
              }}
            >
              ↺ Zurücksetzen
            </button>
          </div>

          {/* Info Box */}
          <div style={{
            padding: '12px',
            background: '#0c4a6e',
            borderRadius: '6px',
            border: '1px solid #0ea5e9',
          }}>
            <ul style={{ color: '#bae6fd', fontSize: '12px', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
              <li>Preisänderungen gelten nur für neue Bestellungen</li>
              <li>Bestehende Bestellungen bleiben unverändert</li>
              <li>Version: {editedConfig.version}</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
