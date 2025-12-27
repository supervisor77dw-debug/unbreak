/**
 * Configurator Buy Button Integration
 * Connects 3D Konfigurator to Checkout API
 * 
 * Usage: Add to configurator.html or configurator.js
 */

/**
 * Collect configuration data from 3D viewer
 * This should be called when user clicks "Buy Now"
 */
function collectConfigurationData() {
  // TODO: Replace with actual 3D konfigurator state
  // This is a placeholder structure
  
  const config = {
    // Product selection
    product: 'wine_glass_holder', // or 'bottle_holder', 'gastro_edition'
    
    // Visual configuration
    color: 'petrol', // petrol | anthracite | graphite
    finish: 'matte', // matte | glossy
    
    // Optional additions
    engraving: null, // { text: 'UNBREAK', font: 'sans' } or null
    
    // 3D Model data (optional - for production)
    modelData: {
      // Camera position, materials applied, etc.
      // This goes to production team
    },
    
    // Preview image (generated from 3D viewer)
    previewImageUrl: null, // screenshot/render URL
    modelExportUrl: null,  // exported .glb/.obj URL
  };
  
  return config;
}

/**
 * Product SKU mapping
 * Maps configurator product selection to database SKU
 */
function getProductSku(productType) {
  const skuMap = {
    'wine_glass_holder': 'UNBREAK-WEIN-01',
    'glass_holder': 'UNBREAK-GLAS-01',
    'bottle_holder': 'UNBREAK-FLASCHE-01',
    'gastro_edition': 'UNBREAK-GASTRO-01',
  };
  
  return skuMap[productType] || 'UNBREAK-WEIN-01';
}

/**
 * Validate customer data
 */
function validateCustomerData(customer) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!customer.email || !emailRegex.test(customer.email)) {
    throw new Error('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
  }
  
  return true;
}

/**
 * Main checkout function
 * Call this when user clicks "Jetzt kaufen" / "Buy Now"
 */
async function startCheckout() {
  try {
    // 1. Show loading state
    const buyButton = document.getElementById('buy-button');
    if (buyButton) {
      buyButton.disabled = true;
      buyButton.textContent = 'Lädt...';
    }
    
    // 2. Collect configuration
    const config = collectConfigurationData();
    const productSku = getProductSku(config.product);
    
    // 3. Get customer email (simple prompt for v1 - replace with proper form)
    const customerEmail = prompt(
      'Bitte geben Sie Ihre E-Mail-Adresse ein, um fortzufahren:'
    );
    
    if (!customerEmail) {
      throw new Error('E-Mail-Adresse erforderlich');
    }
    
    const customer = {
      email: customerEmail.trim(),
      name: null, // Can be collected in Stripe Checkout
      country: 'DE', // Default - can detect via IP or ask user
    };
    
    validateCustomerData(customer);
    
    // 4. Call checkout API
    const response = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_sku: productSku,
        config: config,
        customer: customer,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Checkout fehlgeschlagen');
    }
    
    // 5. Redirect to Stripe Checkout
    console.log('✅ Checkout created:', data.order_number);
    window.location.href = data.checkout_url;
    
  } catch (error) {
    console.error('Checkout error:', error);
    
    // Reset button
    const buyButton = document.getElementById('buy-button');
    if (buyButton) {
      buyButton.disabled = false;
      buyButton.textContent = 'Jetzt kaufen';
    }
    
    // Show error to user
    alert(`Fehler: ${error.message}`);
  }
}

/**
 * Initialize buy button
 * Call this when configurator loads
 */
function initCheckoutButton() {
  const buyButton = document.getElementById('buy-button');
  
  if (!buyButton) {
    console.warn('Buy button not found - add <button id="buy-button">');
    return;
  }
  
  buyButton.addEventListener('click', startCheckout);
  
  console.log('✅ Checkout button initialized');
}

// Auto-initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckoutButton);
} else {
  initCheckoutButton();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startCheckout,
    collectConfigurationData,
    initCheckoutButton,
  };
}
