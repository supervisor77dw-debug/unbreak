/**
 * ENV VALIDATION - Single Source of Truth
 * 
 * REGELN:
 * 1. Keine Auto-Detection von ENV-Variablen
 * 2. Explizite Fehler wenn ENV fehlt
 * 3. Keine Legacy-Fallbacks
 * 4. Alle benötigten ENV hier validieren
 */

// ===================================
// CORE HELPER
// ===================================

/**
 * Require an ENV variable - throws if missing
 * @param {string} name - ENV variable name
 * @returns {string} - ENV value
 * @throws {Error} if ENV is not set
 */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[ENV MISSING] ${name} - Diese Umgebungsvariable muss gesetzt sein.`);
  }
  return value;
}

/**
 * Get optional ENV variable with explicit default
 * @param {string} name - ENV variable name
 * @param {string} defaultValue - Default if not set
 * @returns {string}
 */
export function optionalEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

// ===================================
// STRIPE CONFIGURATION
// ===================================

/**
 * Get Stripe checkout mode (MUST be explicit)
 * @returns {'test' | 'live'}
 */
export function getStripeMode() {
  const mode = process.env.STRIPE_CHECKOUT_MODE;
  if (mode !== 'test' && mode !== 'live') {
    throw new Error(`[ENV INVALID] STRIPE_CHECKOUT_MODE must be 'test' or 'live', got: '${mode}'`);
  }
  return mode;
}

/**
 * Get Stripe secret key for current mode
 * @param {'test' | 'live'} mode - Optional mode override
 * @returns {string}
 */
export function getStripeSecretKey(mode) {
  const effectiveMode = mode || getStripeMode();
  
  if (effectiveMode === 'live') {
    return requireEnv('STRIPE_SECRET_KEY_LIVE');
  } else {
    return requireEnv('STRIPE_SECRET_KEY_TEST');
  }
}

/**
 * Get webhook secrets (pipe-separated for multi-secret support)
 * @returns {string[]}
 */
export function getWebhookSecrets() {
  const secrets = requireEnv('STRIPE_WEBHOOK_SECRETS');
  return secrets.split('|').map(s => s.trim()).filter(Boolean);
}

// ===================================
// EMAIL CONFIGURATION
// ===================================

/**
 * Get email sender for order emails
 * @returns {string}
 */
export function getEmailFromOrders() {
  return requireEnv('EMAIL_FROM_ORDERS');
}

/**
 * Get admin order notification email
 * @returns {string}
 */
export function getAdminOrderEmail() {
  return requireEnv('ADMIN_ORDER_EMAIL');
}

/**
 * Get email sender for support emails
 * @returns {string}
 */
export function getEmailFromSupport() {
  return requireEnv('EMAIL_FROM_SUPPORT');
}

/**
 * Get email sender for no-reply emails
 * @returns {string}
 */
export function getEmailFromNoReply() {
  return requireEnv('EMAIL_FROM_NO_REPLY');
}

// ===================================
// DATABASE CONFIGURATION
// ===================================

/**
 * Get Supabase URL
 * @returns {string}
 */
export function getSupabaseUrl() {
  // Prioritize NEXT_PUBLIC version, fall back to plain SUPABASE_URL
  return process.env.NEXT_PUBLIC_SUPABASE_URL || requireEnv('SUPABASE_URL');
}

/**
 * Get Supabase Service Role Key (server-side only)
 * @returns {string}
 */
export function getSupabaseServiceKey() {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

// ===================================
// NEXTAUTH CONFIGURATION
// ===================================

/**
 * Get NextAuth secret
 * @returns {string}
 */
export function getNextAuthSecret() {
  return requireEnv('NEXTAUTH_SECRET');
}

/**
 * Get NextAuth URL
 * @returns {string}
 */
export function getNextAuthUrl() {
  return requireEnv('NEXTAUTH_URL');
}

// ===================================
// VALIDATION ON STARTUP
// ===================================

/**
 * Validate all required ENV variables at startup
 * Call this in _app.js or api routes to catch missing ENVs early
 * @param {string[]} requiredVars - List of ENV vars to validate
 */
export function validateEnvVars(requiredVars) {
  const missing = [];
  
  for (const name of requiredVars) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }
  
  if (missing.length > 0) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [ENV VALIDATION FAILED]');
    console.error('Missing required environment variables:');
    missing.forEach(name => console.error(`   - ${name}`));
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw new Error(`[ENV MISSING] ${missing.join(', ')}`);
  }
  
  console.log('✅ [ENV VALIDATION] All required ENV vars present');
  return true;
}

/**
 * Log current ENV configuration (for debugging, no secrets)
 */
export function logEnvConfig() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 [ENV CONFIG]');
  console.log(`   STRIPE_CHECKOUT_MODE: ${process.env.STRIPE_CHECKOUT_MODE || '❌ NOT SET'}`);
  console.log(`   STRIPE_SECRET_KEY_TEST: ${process.env.STRIPE_SECRET_KEY_TEST ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   STRIPE_SECRET_KEY_LIVE: ${process.env.STRIPE_SECRET_KEY_LIVE ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   STRIPE_WEBHOOK_SECRETS: ${process.env.STRIPE_WEBHOOK_SECRETS ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   EMAIL_FROM_ORDERS: ${process.env.EMAIL_FROM_ORDERS || '❌ NOT SET'}`);
  console.log(`   ADMIN_ORDER_EMAIL: ${process.env.ADMIN_ORDER_EMAIL || '❌ NOT SET'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || '❌ NOT SET'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ===================================
// REQUIRED ENV LISTS
// ===================================

export const REQUIRED_ENV_STRIPE = [
  'STRIPE_CHECKOUT_MODE',
  'STRIPE_WEBHOOK_SECRETS',
  // One of these must be set based on mode (validated separately)
];

export const REQUIRED_ENV_EMAIL = [
  'RESEND_API_KEY',
  'EMAIL_FROM_ORDERS',
  'ADMIN_ORDER_EMAIL',
];

export const REQUIRED_ENV_DATABASE = [
  'SUPABASE_SERVICE_ROLE_KEY',
  // SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
];

export const REQUIRED_ENV_AUTH = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
];

// Full list for checkout flow
export const REQUIRED_ENV_CHECKOUT = [
  'STRIPE_CHECKOUT_MODE',
  'STRIPE_WEBHOOK_SECRETS',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Full list for email sending
export const REQUIRED_ENV_EMAIL_FULL = [
  'RESEND_API_KEY',
  'EMAIL_FROM_ORDERS',
  'ADMIN_ORDER_EMAIL',
];
