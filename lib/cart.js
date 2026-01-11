// ============================================================
// CART STATE MANAGEMENT - localStorage
// ============================================================
// Manages shopping cart with add/remove/update operations
// Persists to localStorage, validates quantities
// ============================================================

const CART_STORAGE_KEY = 'unbreak_cart';
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

/**
 * Cart item structure:
 * {
 *   product_id: string (UUID),
 *   sku: string,
 *   name: string,
 *   price: number (cents),
 *   quantity: number,
 *   image_url: string | null
 * }
 */

class Cart {
  constructor() {
    this.items = this.load();
  }

  // Load cart from localStorage
  load() {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (!stored) return [];
      
      let items = JSON.parse(stored);
      if (!Array.isArray(items)) items = [];
      
      // MIGRATION: Aggressively remove old configurator items without config
      // These items cannot be checked out (API requires config)
      const validItems = items.filter(item => {
        const isConfiguratorItem = item.product_id === 'glass_configurator' || item.sku === 'glass_configurator';
        
        if (isConfiguratorItem && !item.config) {
          console.warn('[CART][LOAD][MIGRATION] Removing old configurator item without config:', item);
          return false;
        }
        
        return true;
      });
      
      // If we cleaned items, save immediately
      if (validItems.length !== items.length) {
        console.log('[CART][LOAD][MIGRATION] Cleaned cart on load:', {
          before: items.length,
          after: validItems.length,
          removed: items.length - validItems.length,
        });
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(validItems));
      }
      
      return validItems;
    } catch (error) {
      console.error('Failed to load cart:', error);
      return [];
    }
  }

  // Save cart to localStorage
  save() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save cart:', error);
    }
  }

  // Add item to cart (or increase quantity if exists)
  addItem(product) {
    const productId = product.id || product.product_id || product.sku;
    const existingIndex = this.items.findIndex(
      item => item.product_id === productId || item.sku === product.sku
    );

    if (existingIndex >= 0) {
      // Increase quantity
      const newQuantity = this.items[existingIndex].quantity + 1;
      if (newQuantity <= MAX_QUANTITY) {
        this.items[existingIndex].quantity = newQuantity;
      } else {
        console.warn(`Max quantity (${MAX_QUANTITY}) reached for ${product.sku}`);
        return false;
      }
    } else {
      // Determine price: support both standard products and configurator items
      const price = product.price || product.unit_amount || product.base_price_cents;
      
      if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
        console.error('[CART][ADD_ITEM] Invalid price for product:', product);
        return false;
      }

      // Add new item
      this.items.push({
        product_id: productId,
        sku: product.sku,
        name: product.title_de || product.name || product.sku,
        price: Number(price),
        quantity: 1,
        image_url: product.image_url || null,
        // Preserve configurator metadata if present
        configured: product.configured || false,
        config: product.config || null,
        meta: product.meta || null,
      });
    }

    this.save();
    return true;
  }

  // Remove item from cart
  removeItem(productId) {
    this.items = this.items.filter(item => item.product_id !== productId);
    this.save();
  }

  // Update item quantity
  updateQuantity(productId, quantity) {
    const parsedQty = parseInt(quantity, 10);
    
    if (isNaN(parsedQty) || parsedQty < MIN_QUANTITY) {
      console.warn('Invalid quantity:', quantity);
      return false;
    }

    if (parsedQty > MAX_QUANTITY) {
      console.warn(`Max quantity (${MAX_QUANTITY}) exceeded`);
      return false;
    }

    const item = this.items.find(item => item.product_id === productId);
    if (item) {
      item.quantity = parsedQty;
      this.save();
      return true;
    }

    return false;
  }

  // Clear entire cart
  clear() {
    this.items = [];
    this.save();
  }

  // Get all items
  getItems() {
    // MIGRATION: Remove old configurator items without config
    // These are from before the config structure fix (commit 61bb03f)
    const validItems = this.items.filter(item => {
      const isConfiguratorItem = item.product_id === 'glass_configurator' || item.sku === 'glass_configurator';
      
      if (isConfiguratorItem && !item.config) {
        console.warn('[CART][MIGRATION] Removing old configurator item without config:', item.sku);
        return false; // Exclude this item
      }
      
      return true; // Keep this item
    });
    
    // If we filtered out items, save the cleaned cart
    if (validItems.length !== this.items.length) {
      console.log('[CART][MIGRATION] Cleaned cart:', {
        before: this.items.length,
        after: validItems.length,
        removed: this.items.length - validItems.length,
      });
      this.items = validItems;
      this.save();
    }
    
    return [...this.items];
  }

  // Get item count (total quantity)
  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // Get cart total (cents)
  getTotal() {
    return this.items.reduce(
      (sum, item) => {
        const price = Number(item.price);
        const quantity = Number(item.quantity);
        if (!Number.isFinite(price) || !Number.isFinite(quantity)) {
          console.error('[CART][TOTAL_INVALID] Invalid item:', item);
          return sum; // Skip invalid items
        }
        return sum + (price * quantity);
      },
      0
    );
  }

  // Check if cart is empty
  isEmpty() {
    return this.items.length === 0;
  }

  // Format cart for checkout API
  getCheckoutPayload() {
    return this.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      // Include config for configurator items (required by checkout API)
      ...(item.config && { config: item.config }),
      // Include SKU for identification
      sku: item.sku,
    }));
  }

  // Event listeners
  listeners = [];

  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.getItems()));
  }
}

// Singleton instance
let cartInstance = null;

export function getCart() {
  if (!cartInstance) {
    cartInstance = new Cart();
  }
  return cartInstance;
}

// Helper to format price (cents → EUR)
export function formatPrice(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount) || amount < 0) {
    console.error('[CART][PRICE_INVALID] Invalid price:', cents);
    return '0.00'; // Fallback instead of NaN
  }
  return (amount / 100).toFixed(2);
}
