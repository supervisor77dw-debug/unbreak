import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/AdminLayout';
import { formatCentsToEuro, parseEuroToCents } from '../../../lib/utils/currency';

export default function ShippingRatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rates, setRates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchRates();
    }
  }, [session]);

  async function fetchRates() {
    try {
      const res = await fetch('/api/admin/shipping-rates');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRates(data);
    } catch (error) {
      console.error('Error fetching shipping rates:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Versandkosten' });
    }
  }

  async function handleSave(rate) {
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/admin/shipping-rates', {
        method: rate.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rate),
      });

      if (!res.ok) throw new Error('Failed to save');

      setMessage({ type: 'success', text: '✅ Gespeichert!' });
      setEditing(null);
      await fetchRates();
    } catch (error) {
      console.error('Error saving rate:', error);
      setMessage({ type: 'error', text: '❌ Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Versandkosten wirklich löschen?')) return;

    try {
      const res = await fetch(`/api/admin/shipping-rates?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      setMessage({ type: 'success', text: '✅ Gelöscht!' });
      await fetchRates();
    } catch (error) {
      console.error('Error deleting rate:', error);
      setMessage({ type: 'error', text: '❌ Fehler beim Löschen' });
    }
  }

  function startEdit(rate = null) {
    setEditing(rate || {
      countryCode: '',
      labelDe: '',
      labelEn: '',
      priceNet: 0,
      active: true,
      sortOrder: rates.length,
    });
  }

  if (status === 'loading') {
    return <AdminLayout><div>Laden...</div></AdminLayout>;
  }

  if (!session?.user || session.user.role !== 'ADMIN') {
    return <AdminLayout><div>Zugriff verweigert</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', color: '#d4f1f1' }}>📦 Versandkosten</h1>
          <button
            onClick={() => startEdit()}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            + Neue Versandzone
          </button>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '6px',
            background: message.type === 'success' ? '#064e3b' : '#7c2d12',
            color: message.type === 'success' ? '#86efac' : '#fecaca',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#dc2626'}`,
          }}>
            {message.text}
          </div>
        )}

        {editing && (
          <div style={{
            background: '#1a1a1a',
            padding: '24px',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '2px solid #0891b2',
          }}>
            <h3 style={{ color: '#0891b2', marginBottom: '16px' }}>
              {editing.id ? 'Bearbeiten' : 'Neue Versandzone'}
            </h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}>
                  Ländercode (z.B. DE, EU, INT)
                </label>
                <input
                  type="text"
                  value={editing.countryCode}
                  onChange={(e) => setEditing({ ...editing, countryCode: e.target.value.toUpperCase() })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#0a0a0a',
                    color: '#d4f1f1',
                    border: '1px solid #404040',
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}>
                    Bezeichnung (DE)
                  </label>
                  <input
                    type="text"
                    value={editing.labelDe}
                    onChange={(e) => setEditing({ ...editing, labelDe: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#0a0a0a',
                      color: '#d4f1f1',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}>
                    Bezeichnung (EN)
                  </label>
                  <input
                    type="text"
                    value={editing.labelEn}
                    onChange={(e) => setEditing({ ...editing, labelEn: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#0a0a0a',
                      color: '#d4f1f1',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}>
                  Preis (Netto)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={formatCentsToEuro(editing.priceNet)}
                    onChange={(e) => setEditing({ ...editing, priceNet: parseEuroToCents(e.target.value) })}
                    style={{
                      width: '150px',
                      padding: '10px',
                      background: '#0a0a0a',
                      color: '#d4f1f1',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                    }}
                  />
                  <span style={{ color: '#94a3b8' }}>€ (Netto, zzgl. MwSt.)</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  <span style={{ color: '#d4f1f1' }}>Aktiv</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => handleSave(editing)}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
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
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    background: '#1a1a1a',
                    color: '#94a3b8',
                    border: '2px solid #404040',
                    borderRadius: '6px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{
          background: '#1a1a1a',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #404040',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a0a0a', borderBottom: '1px solid #404040' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>Code</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>Zone (DE)</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>Zone (EN)</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontWeight: '600' }}>Preis (Netto)</th>
                <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontWeight: '600' }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '12px', color: '#0891b2', fontWeight: '600', fontFamily: 'monospace' }}>
                    {rate.countryCode}
                  </td>
                  <td style={{ padding: '12px', color: '#d4f1f1' }}>{rate.labelDe}</td>
                  <td style={{ padding: '12px', color: '#cbd5e1' }}>{rate.labelEn}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#d4f1f1', fontFamily: 'monospace' }}>
                    {formatCentsToEuro(rate.priceNet)} €
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: rate.active ? '#064e3b' : '#1a1a1a',
                      color: rate.active ? '#86efac' : '#64748b',
                      border: `1px solid ${rate.active ? '#10b981' : '#404040'}`,
                    }}>
                      {rate.active ? '✓ Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button
                      onClick={() => startEdit(rate)}
                      style={{
                        padding: '6px 12px',
                        background: '#1e3a8a',
                        color: '#bfdbfe',
                        border: '1px solid #3b82f6',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginRight: '8px',
                      }}
                    >
                      ✏️ Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(rate.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#7c2d12',
                        color: '#fecaca',
                        border: '1px solid #dc2626',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      🗑️ Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#1e3a8a',
          borderRadius: '6px',
          border: '1px solid #3b82f6',
          fontSize: '13px',
          color: '#bfdbfe',
        }}>
          ℹ️ <strong>Hinweis:</strong> Alle Preise sind Netto-Beträge. MwSt. (19%) wird bei der Bestellung automatisch aufgeschlagen.
        </div>
      </div>
    </AdminLayout>
  );
}
