# Stripe Webhook + Cart System - Deployment Guide

## ✅ What Was Implemented

### Part A: Stripe Webhook
- **Endpoint:** `/api/webhooks/stripe`
- **Functionality:**
  - Signature verification using `STRIPE_WEBHOOK_SECRET`
  - Handles `checkout.session.completed` event
  - Updates order status from `pending` → `paid`
  - Idempotent (duplicate webhooks are safe)
  - Comprehensive logging for debugging

### Part B: Cart + Multi-Item Checkout
- **Cart System:**
  - localStorage-based state management (`lib/cart.js`)
  - Add/remove items with quantity controls (1-99)
  - Cart page at `/cart` with full UI
  
- **Checkout API:**
  - Supports both legacy (single SKU) and new (items array) format
  - Server-side price validation (prevents client manipulation)
  - Multiple line items in Stripe Checkout
  - Items stored as JSONB in `simple_orders.items`

- **Order Verification:**
  - API endpoint: `/api/orders/verify?session_id=xxx`
  - Success page fetches order details
  - Automatically clears cart after successful payment

---

## 🚀 Deployment Steps

### 1. Update Supabase Schema

Run this SQL in Supabase SQL Editor:

\`\`\`sql
-- Add items column and paid_at timestamp
ALTER TABLE simple_orders
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN simple_orders.items IS 'Cart items: [{product_id, sku, name, unit_price_cents, quantity, image_url}]';
COMMENT ON COLUMN simple_orders.paid_at IS 'Timestamp when payment was confirmed';
\`\`\`

Or use: `database/update-simple-orders-items.sql`

---

### 2. Add Vercel Environment Variables

Go to: **Vercel Dashboard → Project Settings → Environment Variables**

Add this variable (if not already set):

\`\`\`
Name: STRIPE_WEBHOOK_SECRET
Value: (see step 3 below - get from Stripe Dashboard)
Environment: Production, Preview, Development
\`\`\`

---

### 3. Configure Stripe Webhook

#### Option A: Production Webhook (Vercel)

1. Go to: [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Enter endpoint URL:
   \`\`\`
   https://your-domain.vercel.app/api/webhooks/stripe
   \`\`\`
4. Select event to listen to:
   - ✅ `checkout.session.completed`
5. Click **"Add endpoint"**
6. **Copy the Signing Secret** (`whsec_...`)
7. Add it to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`
8. Redeploy on Vercel (or wait for automatic deployment)

#### Option B: Local Testing (Stripe CLI)

\`\`\`bash
# Install Stripe CLI (if not installed)
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to localhost
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# Copy the webhook secret (whsec_...) from terminal output
# Add to .env.local:
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# In another terminal, run dev server
npm run dev

# Trigger test webhook
stripe trigger checkout.session.completed
\`\`\`

---

## 🧪 Testing Instructions

### Test Cart + Checkout Flow

1. **Start local dev server:**
   \`\`\`bash
   npm run dev
   \`\`\`

2. **Add products to cart:**
   - Navigate to your product page
   - Click "Add to Cart" (you'll need to add this button to product UI)
   - Or manually test at `/cart`

3. **View cart:**
   - Go to `/cart`
   - Adjust quantities with +/- buttons
   - Verify subtotal calculations

4. **Checkout:**
   - Click "Zur Kasse" button
   - Should redirect to Stripe Checkout
   - Use test card: `4242 4242 4242 4242` (any future date, any CVC)

5. **Verify webhook:**
   - Complete payment
   - Check Supabase `simple_orders` table
   - Status should change: `pending` → `paid`
   - `paid_at` should be set

6. **Success page:**
   - Should show order details
   - Cart should be cleared

### Test Webhook Directly

\`\`\`bash
# Trigger test event
stripe trigger checkout.session.completed

# Check logs
# Vercel: Dashboard → Functions → Select stripe webhook → View logs
# Local: Check terminal output
\`\`\`

---

## 📊 Database Verification

\`\`\`sql
-- Check recent orders
SELECT 
  id,
  status,
  items,
  total_amount_cents,
  paid_at,
  created_at
FROM simple_orders
ORDER BY created_at DESC
LIMIT 10;

-- Check if items are being stored correctly
SELECT 
  id,
  jsonb_array_length(items) as item_count,
  items->0->>'name' as first_item_name,
  status
FROM simple_orders
WHERE items IS NOT NULL AND items != '[]'::jsonb
ORDER BY created_at DESC;
\`\`\`

---

## 🔍 Debugging

### Webhook Not Working

1. **Check Vercel function logs:**
   - Dashboard → Functions → `/api/webhooks/stripe` → Logs
   - Look for signature verification errors

2. **Verify webhook secret:**
   \`\`\`bash
   # In Vercel Dashboard
   Settings → Environment Variables → STRIPE_WEBHOOK_SECRET
   \`\`\`

3. **Check Stripe webhook attempts:**
   - Stripe Dashboard → Developers → Webhooks → [Your endpoint]
   - View "Recent deliveries" for error messages

4. **Common issues:**
   - ❌ Wrong webhook secret
   - ❌ Endpoint not deployed yet
   - ❌ RLS policy blocking service role

### Order Status Not Updating

\`\`\`sql
-- Check if RLS is blocking updates
SELECT * FROM pg_policies WHERE tablename = 'simple_orders';

-- Ensure service role policy exists
CREATE POLICY "Service role can update simple orders"
ON simple_orders FOR UPDATE
TO service_role
WITH CHECK (true);
\`\`\`

### Cart Not Persisting

- Clear browser localStorage: `localStorage.clear()`
- Check browser console for errors
- Verify `/lib/cart.js` is being imported correctly

---

## 📝 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/checkout/standard` | POST | Create Stripe checkout session |
| `/api/webhooks/stripe` | POST | Handle Stripe webhook events |
| `/api/orders/verify` | GET | Verify order by session_id |

---

## 🎯 Acceptance Criteria

- [x] Webhook verifies Stripe signature
- [x] Order status updates to `paid` after payment
- [x] No duplicate orders from duplicate webhooks
- [x] Cart supports multiple items with quantities
- [x] Server validates prices (no client trust)
- [x] Success page shows order details
- [x] Cart clears after successful checkout
- [x] Backwards compatible with legacy single-SKU checkout

---

## 🔐 Security Checklist

- [x] Webhook signature verification implemented
- [x] Environment secrets not exposed to client
- [x] Server-side price validation
- [x] RLS policies on `simple_orders` table
- [x] Service role used for API operations
- [x] No hardcoded credentials in code

---

## 📦 Next Steps

1. **Add "Add to Cart" button** to product pages
2. **Implement email notifications** (order confirmation)
3. **Admin dashboard** for viewing orders
4. **Inventory management** (track stock levels)
5. **Shipping calculation** (currently hardcoded to 0)

---

## 🛠 Rollback Plan

If issues occur, you can temporarily disable the webhook:

1. Stripe Dashboard → Webhooks → [Your endpoint] → Disable
2. Orders will remain in `pending` status
3. Manually update via Supabase if needed:
   \`\`\`sql
   UPDATE simple_orders
   SET status = 'paid', paid_at = NOW()
   WHERE stripe_session_id = 'cs_test_xxx';
   \`\`\`

---

**Deployment Status:** ✅ Pushed to GitHub (commit a1c8d91)  
**Vercel Status:** 🚀 Auto-deploying  
**Database Migration:** ⏳ Run SQL manually in Supabase
