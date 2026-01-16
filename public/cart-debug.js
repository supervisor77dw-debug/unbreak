/**
 * CART DEBUG HELPER - For Testing Only
 * Add this script to any page to get cart management tools in console
 * 
 * Usage:
 *   clearCart() - Empty cart completely
 *   showCart() - Display current cart contents
 *   addTestItem() - Add a test Glashalter
 */

window.cartDebug = {
  clearCart() {
    localStorage.removeItem('unbreak_cart');
    localStorage.removeItem('unbreak_cart_migration_version');
    console.log('🗑️ Cart cleared!');
    console.log('Reload page to apply changes.');
  },

  showCart() {
    const cart = localStorage.getItem('unbreak_cart');
    if (!cart) {
      console.log('📦 Cart is empty');
      return;
    }
    const parsed = JSON.parse(cart);
    console.log('📦 Current cart:', parsed);
    console.log(`Items: ${parsed.length}`);
    parsed.forEach((item, i) => {
      console.log(`  [${i}] ${item.name} - ${item.sku} - €${(item.unit_price_cents / 100).toFixed(2)} x ${item.quantity}`);
    });
  },

  addTestItem(variant = 'glass') {
    const cart = JSON.parse(localStorage.getItem('unbreak_cart') || '[]');
    
    const testItem = {
      product_id: 'glass_configurator',
      sku: variant === 'glass' ? 'UNBREAK-GLAS-01' : 'UNBREAK-WEIN-01',
      name: variant === 'glass' ? 'Test Glashalter' : 'Test Flaschenhalter',
      unit_price_cents: variant === 'glass' ? 1990 : 2490,
      quantity: 1,
      currency: 'EUR',
      configured: true,
      config: {
        variant: variant === 'glass' ? 'glass_holder' : 'bottle_holder',
        baseColor: '#000000',
        accentColor: '#FFD700',
      },
    };

    cart.push(testItem);
    localStorage.setItem('unbreak_cart', JSON.stringify(cart));
    console.log('✅ Test item added:', testItem.name);
    console.log('Reload page to see changes.');
  },

  nukeEverything() {
    console.log('💥 NUKING ALL UNBREAK STORAGE...');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('unbreak')) {
        localStorage.removeItem(key);
        console.log(`   Removed: ${key}`);
      }
    });
    console.log('✅ All UNBREAK data cleared!');
    console.log('Reload page to start fresh.');
  },
};

// Shortcuts
window.clearCart = window.cartDebug.clearCart;
window.showCart = window.cartDebug.showCart;
window.addTestItem = window.cartDebug.addTestItem;
window.nukeCart = window.cartDebug.nukeEverything;

console.log('🛠️ Cart Debug Helper loaded!');
console.log('Available commands:');
console.log('  clearCart()         - Empty cart');
console.log('  showCart()          - Display cart contents');
console.log('  addTestItem()       - Add test Glashalter');
console.log('  addTestItem("bottle") - Add test Flaschenhalter');
console.log('  nukeCart()          - Remove ALL unbreak localStorage data');
