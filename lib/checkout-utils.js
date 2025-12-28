/**
 * Checkout Utilities - Centralized Stripe Checkout Flow
 * Single source of truth for all "Buy" buttons
 */

/**
 * Start Stripe Checkout for a product
 * @param {Object} options - Checkout options
 * @param {string} options.sku - Product SKU
 * @param {Function} [options.onLoading] - Callback when loading starts
 * @param {Function} [options.onError] - Callback on error
 * @returns {Promise<void>}
 */
export async function startCheckout({ sku, onLoading, onError }) {
  if (!sku) {
    console.error('startCheckout: SKU is required');
    if (onError) onError(new Error('Product SKU is missing'));
    return;
  }

  try {
    // Call loading callback
    if (onLoading) onLoading(true);

    // POST to checkout API
    const response = await fetch('/api/checkout/standard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sku }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.url) {
      throw new Error('Checkout session URL missing');
    }

    // Redirect to Stripe Checkout
    window.location.assign(data.url);
  } catch (error) {
    console.error('Checkout error:', error);
    
    // Call loading callback to stop spinner
    if (onLoading) onLoading(false);
    
    // Call error callback or show default alert
    if (onError) {
      onError(error);
    } else {
      alert(`Fehler beim Starten des Checkouts: ${error.message}\n\nBitte versuchen Sie es erneut.`);
    }
  }
}

/**
 * Legacy support - backward compatible with old onclick handlers
 * @deprecated Use startCheckout instead
 */
export function buyProduct(sku) {
  return startCheckout({ sku });
}
