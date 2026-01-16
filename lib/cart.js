// ============================================================
// CART STATE MANAGEMENT - localStorage
// ============================================================
// Manages shopping cart with add/remove/update operations
// Persists to localStorage, validates quantities
// ============================================================

const CART_STORAGE_KEY = 'unbreak_cart';
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

/**
 * ============================================================
 * CANONICAL CART ITEM SCHEMA (SINGLE SOURCE OF TRUTH)
 * ============================================================
 * {
 *   product_id: string (UUID),
 *   sku: string,
 *   name: string,
 *   unit_price_cents: number (INTEGER - ONLY price field allowed),
 *   quantity: number,
 *   currency: 'EUR',
 *   image_url: string | null,
 *   configured: boolean,
 *   config: object | null,
 *   lang: string | null
 * }
 *
 * FORBIDDEN FIELDS (legacy): price, price_cents, base_price, total_price, displayPrice
 * ============================================================
 */

/**
 * Normalize cart item to canonical schema
 * @param {object} rawItem - Raw item from any source (configurator, product, legacy)
 * @returns {object} Normalized item with ONLY unit_price_cents
 */
function normalizeCartItem(rawItem) {
  if (!rawItem) {
    throw new Error('[CART][NORMALIZE] Item is null/undefined');
  }

  let unit_price_cents = 0;

  // PRIORITY 1: unit_price_cents (canonical field)
  if (rawItem.unit_price_cents && Number.isInteger(rawItem.unit_price_cents)) {
    unit_price_cents = rawItem.unit_price_cents;
  }
  // PRIORITY 2: price_cents (common field from configurator)
  else if (rawItem.price_cents) {
    unit_price_cents = Math.round(Number(rawItem.price_cents));
  }
  // PRIORITY 3: price field (AMBIGUOUS - could be cents OR euro)
  else if (rawItem.price != null) {
    const priceValue = Number(rawItem.price);
    
    // HEURISTIC: Disambiguate cents vs euro
    // If price >= 100 → probably cents (e.g., 1990, 2490, 3900)
    // If price < 100 → probably euro (e.g., 19.90, 24.90, 39.00)
    if (priceValue >= 100) {
      // Treat as cents
      unit_price_cents = Math.round(priceValue);
      if (DEBUG) console.log('[CART][NORMALIZE] price >= 100 → treated as cents:', { sku: rawItem.sku, price: priceValue, unit_price_cents });
    } else {
      // Treat as euro, convert to cents
      unit_price_cents = Math.round(priceValue * 100);
      if (DEBUG) console.log('[CART][NORMALIZE] price < 100 → treated as euro:', { sku: rawItem.sku, price: priceValue, unit_price_cents });
    }
  }
  // PRIORITY 4: Other legacy fields
  else if (rawItem.base_price_cents) {
    unit_price_cents = Math.round(Number(rawItem.base_price_cents));
  } else if (rawItem.unit_amount) {
    unit_price_cents = Math.round(Number(rawItem.unit_amount));
  }

  // VALIDATION: unit_price_cents MUST be positive integer
  // EXCEPTION: Configurator items can have 0 (server calculates)
  const isConfiguratorItem = rawItem.configured || rawItem.product_id === 'glass_configurator' || rawItem.sku === 'UNBREAK-GLAS-CONFIG';
  
  if (!Number.isInteger(unit_price_cents)) {
    console.error('[CART][NORMALIZE] unit_price_cents is not an integer:', { sku: rawItem.sku, unit_price_cents, rawItem });
    unit_price_cents = Math.round(unit_price_cents);
  }

  if (unit_price_cents < 0) {
    throw new Error(`[CART][NORMALIZE] Negative price for ${rawItem.sku}: ${unit_price_cents}`);
  }

  if (unit_price_cents === 0 && !isConfiguratorItem) {
    console.warn('[CART][NORMALIZE] Zero price for non-configurator item:', rawItem.sku);
  }

  // Build canonical item (ONLY allowed fields)
  const normalized = {
    product_id: rawItem.product_id || rawItem.id || rawItem.sku,
    sku: rawItem.sku,
    name: rawItem.name || rawItem.title_de || rawItem.sku,
    unit_price_cents,  // ✅ ONLY price field
    quantity: rawItem.quantity || 1,
    currency: 'EUR',
    image_url: rawItem.image_url || null,
    configured: rawItem.configured || false,
    config: rawItem.config || null,
    lang: rawItem.lang || null,
    meta: rawItem.meta || null,
  };

  // DEBUG: Log normalization
  if (DEBUG) {
    console.log('[CART][NORMALIZE] Item normalized:', {
      sku: normalized.sku,
      unit_price_cents: normalized.unit_price_cents,
      quantity: normalized.quantity,
      raw_price: rawItem.price,
      raw_price_cents: rawItem.price_cents,
      raw_unit_price_cents: rawItem.unit_price_cents,
    });
  }

  return normalized;
}

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
      
      // MIGRATION STEP 1: Remove invalid configurator items
      const validItems = items.filter(item => {
        const isConfiguratorItem = item.product_id === 'glass_configurator' || item.sku === 'glass_configurator';
        
        if (isConfiguratorItem && !item.config) {
          if (DEBUG) console.warn('[CART][LOAD][MIGRATION] ❌ Removing old configurator item without config:', {
            product_id: item.product_id,
            sku: item.sku,
            has_config: !!item.config
          });
          return false;
        }
        
        return true;
      });

      // MIGRATION STEP 2: Normalize ALL items to canonical schema
      // FORCE MIGRATION: Always normalize to remove legacy fields
      const normalizedItems = validItems.map(item => {
        try {
          return normalizeCartItem(item);
        } catch (error) {
          console.error('[CART][LOAD][MIGRATION] Failed to normalize item, skipping:', item.sku, error);
          return null;
        }
      }).filter(Boolean); // Remove failed normalizations
      
      // ALWAYS SAVE: Ensure legacy fields are removed from localStorage
      if (DEBUG) console.log('[CART][LOAD][MIGRATION] 🔄 Normalized cart:', {
        items: normalizedItems.length,
        sample: normalizedItems[0] ? {
          sku: normalizedItems[0].sku,
          unit_price_cents: normalizedItems[0].unit_price_cents,
          has_legacy_price: normalizedItems[0].price !== undefined,
          has_legacy_price_cents: normalizedItems[0].price_cents !== undefined,
        } : null
      });
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizedItems));
      
      return normalizedItems;
    } catch (error) {
      console.error('Failed to load cart:', error);
      return [];
    }
  }

  // Save cart to localStorage
  save() {
    if (typeof window === 'undefined') return;
    
    try {
      const itemsToSave = this.items;
      if (DEBUG) console.log('[CART][SAVE] Saving to localStorage:', {
        items_count: itemsToSave.length,
        items: itemsToSave.map(i => ({ 
          sku: i.sku, 
          qty: i.quantity,
          configured: i.configured,
          has_config: !!i.config
        }))
      });
      
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(itemsToSave));
      
      // Verify save worked
      const savedData = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = savedData ? JSON.parse(savedData) : [];
      if (DEBUG) console.log('[CART][SAVE] ✅ Saved successfully. Verified count:', parsed.length);
      
      this.notifyListeners();
    } catch (error) {
      console.error('[CART][SAVE] ❌ Failed to save cart:', error);
    }
  }

  // Add item to cart (or increase quantity if exists)
  addItem(product) {
    // STEP 1: Normalize item to canonical schema
    let normalizedItem;
    try {
      normalizedItem = normalizeCartItem(product);
    } catch (error) {
      console.error('[CART][ADD_ITEM] Failed to normalize item:', product.sku, error);
      return false;
    }

    if (DEBUG) console.log('[CART][ADD_ITEM] Normalized item:', {
      sku: normalizedItem.sku,
      unit_price_cents: normalizedItem.unit_price_cents,
      quantity: normalizedItem.quantity,
      configured: normalizedItem.configured,
    });

    // STEP 2: Check if item already exists in cart
    const existingIndex = this.items.findIndex(
      item => item.product_id === normalizedItem.product_id || item.sku === normalizedItem.sku
    );

    if (existingIndex >= 0) {
      // Increase quantity
      const newQuantity = this.items[existingIndex].quantity + 1;
      if (newQuantity <= MAX_QUANTITY) {
        this.items[existingIndex].quantity = newQuantity;
      } else {
        console.warn(`Max quantity (${MAX_QUANTITY}) reached for ${normalizedItem.sku}`);
        return false;
      }
    } else {
      // Add new item (already normalized)
      this.items.push(normalizedItem);
    }

    this.save();
    
    if (DEBUG) console.log('[CART][ADD_ITEM] Cart saved. Items count:', this.items.length);
    
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
        const price = Number(item.unit_price_cents);
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
      // Include price for pricing calculation (canonical field only)
      price_cents: item.unit_price_cents,
      // Include name for display
      name: item.name,
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

// Export normalizeCartItem for external use
export { normalizeCartItem };
