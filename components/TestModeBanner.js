/**
 * TESTMODUS-BANNER
 * 
 * Wird nur im Test-Mode angezeigt (pk_test_ Schlüssel)
 * Warnt Benutzer, dass keine echten Zahlungen verarbeitet werden
 */

import { useEffect, useState } from 'react';

export default function TestModeBanner() {
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    // Check if test mode via API
    fetch('/api/stripe-mode')
      .then(res => res.json())
      .then(data => {
        setIsTestMode(data.isTestMode === true);
      })
      .catch(err => {
        console.error('Failed to check Stripe mode:', err);
      });
  }, []);

  if (!isTestMode) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(135deg, #ff9800, #f57c00)',
      color: '#000',
      padding: '12px 20px',
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: '14px',
      zIndex: 99999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      borderBottom: '2px solid #e65100',
    }}>
      ⚠️ TESTMODUS AKTIV – Keine echten Zahlungen – Nur für Tests
    </div>
  );
}
