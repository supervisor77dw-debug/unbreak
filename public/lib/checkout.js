/**
 * UNBREAK ONE - Checkout Client Library
 * 
 * Zentrale Library für alle Checkout-Operationen.
 * Automatische Integration mit Stripe Checkout APIs.
 * 
 * SICHERHEIT:
 * - Preise werden NIE aus dem Frontend gesendet
 * - Server berechnet finale Preise aus Supabase
 * - Frontend übergibt nur Identifier (SKU, Bundle-ID, Preset-ID)
 * 
 * USAGE:
 * ```javascript
 * import { buyStandard, buyBundle, buyPreset } from './lib/checkout.js';
 * 
 * // Standard Product
 * buyStandard('UO-GLASS-01');
 * 
 * // Bundle
 * buyBundle('uuid-bundle-id');
 * 
 * // Preset
 * buyPreset('uuid-preset-id');
 * ```
 * 
 * ODER mit data-Attributen:
 * ```html
 * <button data-checkout="standard" data-sku="UO-GLASS-01">Kaufen</button>
 * <button data-checkout="bundle" data-bundle-id="uuid">Kaufen</button>
 * <button data-checkout="preset" data-preset-id="uuid">Kaufen</button>
 * ```
 */

/**
 * Checkout für Standard-Produkt
 * @param {string} sku - Produkt-SKU (z.B. "UO-GLASS-01")
 * @param {Object} options - Optionale Konfiguration
 * @param {string} options.email - Kunden-Email (optional)
 * @param {HTMLButtonElement} options.button - Button für Loading State
 * @returns {Promise<void>}
 */
export async function buyStandard(sku, options = {}) {
  if (!sku) {
    throw new Error('SKU is required');
  }

  const { button, email } = options;

  try {
    // Button in Loading-State
    if (button) {
      setButtonLoading(button, true);
    }

    // POST zu Checkout API
    const response = await fetch('/api/checkout/standard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        sku,
        ...(email && { email })
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Checkout failed: ${response.status}`);
    }

    if (!data.url) {
      throw new Error('No checkout URL received from server');
    }

    // Redirect zu Stripe Checkout
    window.location.href = data.url;

  } catch (error) {
    console.error('[Checkout] Standard product error:', error);
    
    // Button zurücksetzen
    if (button) {
      setButtonLoading(button, false);
    }

    // User-Feedback
    showError(error.message);
    throw error;
  }
}

/**
 * Checkout für Bundle
 * @param {string} bundleId - Bundle UUID aus Supabase
 * @param {Object} options - Optionale Konfiguration
 * @param {string} options.email - Kunden-Email (optional)
 * @param {HTMLButtonElement} options.button - Button für Loading State
 * @returns {Promise<void>}
 */
export async function buyBundle(bundleId, options = {}) {
  if (!bundleId) {
    throw new Error('Bundle ID is required');
  }

  const { button, email } = options;

  try {
    // Button in Loading-State
    if (button) {
      setButtonLoading(button, true);
    }

    // POST zu Checkout API
    const response = await fetch('/api/checkout/bundle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        bundle_id: bundleId,
        ...(email && { email })
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Checkout failed: ${response.status}`);
    }

    if (!data.url) {
      throw new Error('No checkout URL received from server');
    }

    // Redirect zu Stripe Checkout
    window.location.href = data.url;

  } catch (error) {
    console.error('[Checkout] Bundle error:', error);
    
    // Button zurücksetzen
    if (button) {
      setButtonLoading(button, false);
    }

    // User-Feedback
    showError(error.message);
    throw error;
  }
}

/**
 * Checkout für Preset (vorkonfiguriertes Produkt)
 * @param {string} presetId - Preset UUID aus Supabase
 * @param {Object} options - Optionale Konfiguration
 * @param {string} options.email - Kunden-Email (optional)
 * @param {HTMLButtonElement} options.button - Button für Loading State
 * @returns {Promise<void>}
 */
export async function buyPreset(presetId, options = {}) {
  if (!presetId) {
    throw new Error('Preset ID is required');
  }

  const { button, email } = options;

  try {
    // Button in Loading-State
    if (button) {
      setButtonLoading(button, true);
    }

    // POST zu Checkout API
    const response = await fetch('/api/checkout/preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        preset_id: presetId,
        ...(email && { email })
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Checkout failed: ${response.status}`);
    }

    if (!data.url) {
      throw new Error('No checkout URL received from server');
    }

    // Redirect zu Stripe Checkout
    window.location.href = data.url;

  } catch (error) {
    console.error('[Checkout] Preset error:', error);
    
    // Button zurücksetzen
    if (button) {
      setButtonLoading(button, false);
    }

    // User-Feedback
    showError(error.message);
    throw error;
  }
}

/**
 * Initialisiert Event-Listener für alle Checkout-Buttons mit data-Attributen
 * Automatisch aufgerufen, wenn als Modul geladen
 * 
 * Unterstützte data-Attribute:
 * - data-checkout="standard" data-sku="..."
 * - data-checkout="bundle" data-bundle-id="..."
 * - data-checkout="preset" data-preset-id="..."
 */
export function initCheckoutButtons() {
  // Standard Products
  document.querySelectorAll('[data-checkout="standard"]').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const sku = button.dataset.sku;
      if (!sku) {
        console.error('[Checkout] Missing data-sku on button:', button);
        return;
      }
      await buyStandard(sku, { button });
    });
  });

  // Bundles
  document.querySelectorAll('[data-checkout="bundle"]').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const bundleId = button.dataset.bundleId;
      if (!bundleId) {
        console.error('[Checkout] Missing data-bundle-id on button:', button);
        return;
      }
      await buyBundle(bundleId, { button });
    });
  });

  // Presets
  document.querySelectorAll('[data-checkout="preset"]').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const presetId = button.dataset.presetId;
      if (!presetId) {
        console.error('[Checkout] Missing data-preset-id on button:', button);
        return;
      }
      await buyPreset(presetId, { button });
    });
  });

  console.log('[Checkout] Initialized checkout buttons');
}

/**
 * Helper: Button Loading State
 */
function setButtonLoading(button, isLoading) {
  if (!button) return;

  if (isLoading) {
    // Store original text
    button.dataset.originalText = button.textContent;
    
    // Set loading text (i18n-aware)
    const lang = document.documentElement.lang || 'de';
    button.textContent = lang === 'de' ? 'Wird geladen...' : 'Loading...';
    button.disabled = true;
    button.classList.add('loading');
  } else {
    // Restore original text
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.classList.remove('loading');
  }
}

/**
 * Helper: Error Anzeige
 */
function showError(message) {
  // Simple alert (kann später durch fancy Notification ersetzt werden)
  const lang = document.documentElement.lang || 'de';
  const prefix = lang === 'de' ? 'Fehler beim Checkout:' : 'Checkout error:';
  alert(`${prefix} ${message}`);
}

/**
 * Auto-Init wenn als Modul geladen
 * Wartet auf DOMContentLoaded oder führt sofort aus wenn DOM schon bereit
 */
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckoutButtons);
  } else {
    // DOM already loaded
    initCheckoutButtons();
  }
  
  // Make available globally for manual re-init (e.g., after dynamic product render)
  window.initCheckoutButtons = initCheckoutButtons;
}

// Export für manuelle Initialisierung
export default {
  buyStandard,
  buyBundle,
  buyPreset,
  initCheckoutButtons
};
