/**
 * UNBREAK ONE - Checkout Integration
 * Production-Ready Button Handlers
 * 
 * WICHTIG: Keine Design-Änderungen - nur Funktionalität ergänzen
 */

/**
 * Buy Standard Product (without configuration)
 * Usage: onclick="UnbreakCheckout.buyStandard('UNBREAK-WEIN-01')"
 */
const UnbreakCheckout = {
  
  /**
   * Standard Product Checkout
   * @param {string} sku - Product SKU (e.g., 'UNBREAK-WEIN-01')
   * @param {object} options - Optional customer data
   */
  async buyStandard(sku, options = {}) {
    try {
      // Show loading state (optional, uses existing button)
      const btn = event?.target;
      const originalText = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Lädt...';
      }

      // Call checkout API
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_sku: sku,
          config: {}, // Empty config for standard products
          customer: {
            email: options.email || null,
            name: options.name || null,
            address: options.address || null,
            country: options.country || 'DE'
          }
        }),
      });

      // Handle response
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        console.log('✓ Checkout Session erstellt:', data.order_id);
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }

    } catch (error) {
      console.error('❌ Checkout Error:', error);
      
      // Restore button
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      // Show user-friendly error
      alert(`Fehler beim Checkout: ${error.message}\n\nBitte versuche es erneut oder kontaktiere uns.`);
    }
  },

  /**
   * Configured Product Checkout (from 3D Configurator)
   * @param {object} config - Configuration object with color, finish, etc.
   */
  async buyConfigured(config) {
    try {
      // Show loading
      const btn = event?.target;
      const originalText = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Lädt...';
      }

      // Validate config
      if (!config || !config.color) {
        throw new Error('Bitte wähle zuerst eine Farbe aus');
      }

      // Default product SKU for configurator
      const sku = config.productSku || 'UNBREAK-GLAS-01';

      // Call checkout API
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_sku: sku,
          config: {
            color: config.color,
            finish: config.finish || 'matte',
            engraving: config.engraving || null,
            quantity: config.quantity || 1,
            // Add any other configurator options
            edition: config.edition || null,
          },
          customer: {
            email: config.email || null,
            name: config.name || null,
            address: config.address || null,
            country: config.country || 'DE'
          }
        }),
      });

      // Handle response
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const data = await response.json();
      
      console.log('✓ Konfiguration gespeichert:', data.configuration_id);
      console.log('✓ Order erstellt:', data.order_id);

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }

    } catch (error) {
      console.error('❌ Checkout Error:', error);
      
      // Restore button
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      // Show user-friendly error
      alert(`Fehler beim Checkout: ${error.message}\n\nBitte versuche es erneut oder kontaktiere uns.`);
    }
  },

  /**
   * Quick Buy - One-click checkout für mobile/express
   * @param {string} sku - Product SKU
   * @param {number} quantity - Quantity (default 1)
   */
  async quickBuy(sku, quantity = 1) {
    return this.buyStandard(sku, { quantity });
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.UnbreakCheckout = UnbreakCheckout;
}

// Export for module usage
export default UnbreakCheckout;
