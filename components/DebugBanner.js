/**
 * DEBUG BANNER - Visuelles Kennzeichen für Test-Modus
 * 
 * PFLICHT-REGEL: Erscheint IMMER wenn Stripe Test-Keys genutzt werden
 * GARANTIE: Niemals im LIVE-Modus sichtbar (prüft pk_live_ Prefix)
 * 
 * Prüfung: Publishable Key beginnt mit pk_test_ → DEBUG
 */

import { useEffect, useState } from 'react';

export default function DebugBanner() {
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    // Prüfe ob Publishable Key ein Test-Key ist
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const isTest = publishableKey?.startsWith('pk_test_');
    setIsDebugMode(isTest);

    if (isTest) {
      console.log('⚠️ [DEBUG BANNER] ACTIVE - Test-Modus erkannt (pk_test_)');
    }
  }, []);

  // LIVE-Modus: Kein Banner
  if (!isDebugMode) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: '#ff9800',
      color: '#000',
      padding: '12px 20px',
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: '14px',
      zIndex: 999999,
      borderBottom: '4px solid #f57c00',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      ⚠️ DEBUG MODE – TESTUMGEBUNG – KEINE LIVE-BESTELLUNGEN
    </div>
  );
}
