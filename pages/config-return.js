/**
 * CONFIGURATOR RETURN HANDLER
 * 
 * Handles return from 3D configurator WITHOUT client-side CORS issues.
 * 
 * Flow:
 * 1. Configurator redirects to: /config-return?sessionId=xyz
 * 2. This page loads session SERVER-SIDE (no CORS)
 * 3. Adds config to cart via localStorage
 * 4. Redirects to /shop (clean URL, same origin)
 * 
 * CRITICAL: NO client-side fetch to /api/* - all data fetched in getServerSideProps
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ConfigReturn({ configData, error }) {
  const router = useRouter();

  useEffect(() => {
    if (error) {
      console.error('[CONFIG-RETURN] Error:', error);
      // Redirect to shop with error flag
      router.replace('/shop?error=config_load_failed');
      return;
    }

    if (!configData) {
      console.error('[CONFIG-RETURN] No config data');
      router.replace('/shop?error=config_not_found');
      return;
    }

    // Save config to localStorage for cart pickup
    try {
      localStorage.setItem('pendingConfiguratorItem', JSON.stringify(configData));
      console.log('[CONFIG-RETURN] Config saved to localStorage:', configData);
      
      // Redirect to shop (same origin, clean URL)
      router.replace('/shop?from=configurator');
    } catch (err) {
      console.error('[CONFIG-RETURN] Failed to save config:', err);
      router.replace('/shop?error=storage_failed');
    }
  }, [configData, error, router]);

  // Loading state while redirecting
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          margin: '0 auto 20px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p>Konfiguration wird geladen...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * SERVER-SIDE: Load configurator session and prepare cart data
 * 
 * This runs on the server, so:
 * - No CORS issues (same-origin API calls)
 * - Fast response (no client-side round trips)
 * - Clean separation of concerns
 */
export async function getServerSideProps(context) {
  const { sessionId, session, cfgId } = context.query;
  const actualSessionId = sessionId || session || cfgId;

  if (!actualSessionId) {
    return {
      props: {
        error: 'No session ID provided',
        configData: null,
      },
    };
  }

  try {
    // Build absolute API URL for server-side fetch
    const protocol = context.req.headers['x-forwarded-proto'] || 'https';
    const host = context.req.headers.host;
    const apiUrl = `${protocol}://${host}/api/config-session/${actualSessionId}`;

    console.log('[CONFIG-RETURN SSR] Fetching session:', apiUrl);

    // Fetch session data (server-side, no CORS)
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('[CONFIG-RETURN SSR] Session not found:', response.status);
      return {
        props: {
          error: 'Session not found or expired',
          configData: null,
        },
      };
    }

    const sessionData = await response.json();
    const { lang, config } = sessionData.data || sessionData;

    console.log('[CONFIG-RETURN SSR] Session loaded:', {
      lang,
      configKeys: Object.keys(config || {}),
    });

    // Transform config for pricing engine
    const transformedConfig = {
      colors: {
        base: config.base || null,
        arm: config.arm || null,
        module: config.module || null,
        pattern: config.pattern || null,
      },
      finish: config.finish || 'matte',
      variant: config.variant || 'standard',
    };

    // Calculate price (server-side)
    let priceCents = 4990; // Fallback
    try {
      const pricingUrl = `${protocol}://${host}/api/pricing/calculate`;
      const pricingResponse = await fetch(pricingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'glass_holder',
          config: transformedConfig,
          customFeeCents: 0,
        }),
      });

      if (pricingResponse.ok) {
        const pricingData = await pricingResponse.json();
        priceCents = pricingData.pricing.subtotal_cents;
        console.log('[CONFIG-RETURN SSR] Price calculated:', priceCents);
      } else {
        console.warn('[CONFIG-RETURN SSR] Pricing failed, using fallback');
      }
    } catch (pricingError) {
      console.error('[CONFIG-RETURN SSR] Pricing error:', pricingError);
    }

    // Prepare cart item
    const cartItem = {
      id: 'glass_configurator',
      product_id: 'glass_configurator',
      sku: 'glass_configurator',
      name: lang === 'en' ? 'Glass Holder – Custom' : 'Glashalter – Konfigurator',
      price: priceCents,
      unit_amount: priceCents,
      currency: 'EUR',
      quantity: 1,
      configured: true,
      config: transformedConfig,
      meta: {
        source: 'configurator',
        sessionId: actualSessionId,
        colors: transformedConfig.colors,
        finish: transformedConfig.finish,
      },
    };

    // Delete session (cleanup) - fire and forget
    fetch(`${protocol}://${host}/api/config-session/${actualSessionId}`, {
      method: 'DELETE',
    }).catch(err => {
      console.warn('[CONFIG-RETURN SSR] Cleanup failed:', err);
    });

    return {
      props: {
        configData: cartItem,
        error: null,
      },
    };
  } catch (error) {
    console.error('[CONFIG-RETURN SSR] Error:', error);
    return {
      props: {
        error: error.message || 'Unknown error',
        configData: null,
      },
    };
  }
}
