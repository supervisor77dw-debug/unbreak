import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import AdminLayout from '../../../components/AdminLayout';

export default function PricingConfigPage() {
  const router = useRouter();
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

  // Auth check
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push(`/admin/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
    }
  }, [session, status, router]);

  // Fetch pricing configs
  useEffect(() => {
    if (!session) return;
    fetchConfigs();
  }, [session]);

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

  // Switch variant
  useEffect(() => {
    if (configs[activeVariant]) {
      setEditedConfig({ ...configs[activeVariant] });
    }
  }, [activeVariant, configs]);

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

  function updateColorPrice(part, color, value) {
    setEditedConfig(prev => ({
      ...prev,
      color_prices: {
        ...prev.color_prices,
        [part]: {
          ...prev.color_prices[part],
          [color]: parseInt(value) || 0,
        },
      },
    }));
  }

  function updateFinishPrice(finish, value) {
    setEditedConfig(prev => ({
      ...prev,
      finish_prices: {
        ...prev.finish_prices,
        [finish]: parseInt(value) || 0,
      },
    }));
  }

  if (status === 'loading' || loading) {
    return <AdminLayout><div>Laden...</div></AdminLayout>;
  }

  if (!session) {
    return null;
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px', maxWidth: '1200px' }}>
        <h1 style={{ marginBottom: '24px', color: '#d4f1f1' }}>⚙️ Pricing Configuration</h1>

        {message && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            borderRadius: '8px',
            background: message.type === 'success' ? '#064e3b' : '#7c2d12',
            color: message.type === 'success' ? '#86efac' : '#fecaca',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#dc2626'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Variant Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <button
            onClick={() => setActiveVariant('glass_holder')}
            style={{
              padding: '12px 24px',
              background: activeVariant === 'glass_holder' ? '#0891b2' : '#1a1a1a',
              color: 'white',
              border: activeVariant === 'glass_holder' ? '2px solid #06b6d4' : '2px solid #404040',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            🍷 Glashalter
          </button>
          <button
            onClick={() => setActiveVariant('bottle_holder')}
            style={{
              padding: '12px 24px',
              background: activeVariant === 'bottle_holder' ? '#0891b2' : '#1a1a1a',
              color: 'white',
              border: activeVariant === 'bottle_holder' ? '2px solid #06b6d4' : '2px solid #404040',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
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
              padding: '24px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '1px solid #404040',
            }}>
              <h2 style={{ color: '#0891b2', marginBottom: '16px' }}>Basispreis</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="number"
                  value={editedConfig.base_price_cents || 0}
                  onChange={(e) => setEditedConfig(prev => ({
                    ...prev,
                    base_price_cents: parseInt(e.target.value) || 0,
                  }))}
                  style={{
                    padding: '12px',
                    fontSize: '18px',
                    width: '150px',
                    background: '#0a0a0a',
                    color: '#d4f1f1',
                    border: '2px solid #404040',
                    borderRadius: '6px',
                  }}
                />
                <span style={{ color: '#94a3b8', fontSize: '16px' }}>
                  Cent (= €{((editedConfig.base_price_cents || 0) / 100).toFixed(2)})
                </span>
              </div>
            </div>

            {/* Color Upcharges */}
            <div style={{
              background: '#1a1a1a',
              padding: '24px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '1px solid #404040',
            }}>
              <h2 style={{ color: '#0891b2', marginBottom: '16px' }}>🎨 Farb-Aufschläge</h2>
              
              {Object.entries(editedConfig.color_prices || {}).map(([part, colors]) => (
                <div key={part} style={{ marginBottom: '24px' }}>
                  <h3 style={{ 
                    color: '#94a3b8', 
                    fontSize: '14px', 
                    textTransform: 'uppercase', 
                    marginBottom: '12px',
                    fontWeight: '600',
                  }}>
                    {part}
                  </h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                    gap: '12px' 
                  }}>
                    {Object.entries(colors).map(([color, price]) => (
                      <div key={color} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#0a0a0a',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #404040',
                      }}>
                        <span style={{ 
                          color: '#d4f1f1', 
                          flex: 1, 
                          fontSize: '14px',
                          textTransform: 'capitalize',
                        }}>
                          {color}:
                        </span>
                        <input
                          type="number"
                          value={price}
                          onChange={(e) => updateColorPrice(part, color, e.target.value)}
                          style={{
                            width: '80px',
                            padding: '6px',
                            background: '#000',
                            color: '#fbbf24',
                            border: '1px solid #404040',
                            borderRadius: '4px',
                            fontSize: '13px',
                            textAlign: 'right',
                          }}
                        />
                        <span style={{ color: '#64748b', fontSize: '12px' }}>¢</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Finish Upcharges */}
            <div style={{
              background: '#1a1a1a',
              padding: '24px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '1px solid #404040',
            }}>
              <h2 style={{ color: '#0891b2', marginBottom: '16px' }}>✨ Finish-Aufschläge</h2>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                gap: '12px' 
              }}>
                {Object.entries(editedConfig.finish_prices || {}).map(([finish, price]) => (
                  <div key={finish} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#0a0a0a',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #404040',
                  }}>
                    <span style={{ 
                      color: '#d4f1f1', 
                      flex: 1, 
                      fontSize: '14px',
                      textTransform: 'capitalize',
                    }}>
                      {finish}:
                    </span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => updateFinishPrice(finish, e.target.value)}
                      style={{
                        width: '80px',
                        padding: '6px',
                        background: '#000',
                        color: '#fbbf24',
                        border: '1px solid #404040',
                        borderRadius: '4px',
                        fontSize: '13px',
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>¢</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '16px 32px',
                  background: saving ? '#404040' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                }}
              >
                {saving ? '💾 Speichern...' : '💾 Speichern'}
              </button>
              <button
                onClick={() => setEditedConfig({ ...configs[activeVariant] })}
                disabled={saving}
                style={{
                  padding: '16px 32px',
                  background: '#1a1a1a',
                  color: '#94a3b8',
                  border: '2px solid #404040',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                }}
              >
                ↺ Zurücksetzen
              </button>
            </div>

            {/* Info Box */}
            <div style={{
              marginTop: '32px',
              padding: '16px',
              background: '#0c4a6e',
              borderRadius: '8px',
              border: '1px solid #0ea5e9',
            }}>
              <div style={{ color: '#7dd3fc', fontSize: '14px', marginBottom: '8px', fontWeight: '600' }}>
                ℹ️ Wichtig
              </div>
              <ul style={{ color: '#bae6fd', fontSize: '13px', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
                <li>Preisänderungen gelten NUR für neue Bestellungen</li>
                <li>Bestehende Bestellungen bleiben unverändert (Freeze Pricing)</li>
                <li>Alle Preise in Cent (100¢ = 1€)</li>
                <li>Version: {editedConfig.version}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
