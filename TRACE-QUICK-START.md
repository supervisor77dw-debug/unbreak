# UNBREAK ONE - E2E TRACE SYSTEM - QUICK START

## ✅ COMPLETED

1. **Database Schema**
   - File: `database/add-trace-id.sql`
   - Adds `trace_id` column to `orders` and `simple_orders`
   
2. **Client Trace System**
   - File: `public/configurator/trace-system.js`
   - Complete E2E tracing with UUID generation
   - Export logs, debug UI, sessionStorage
   
3. **HTML Integration**
   - File: `public/configurator.html`
   - Added `<script src="configurator/trace-system.js"></script>`
   
4. **Checkout Integration (Partial)**
   - File: `public/checkout.js`
   - Added trace initialization on page load
   - Added trace_id to `buyConfigured()` function
   - Added config snapshot logging
   - Added X-Trace-ID header to API call

## 🔧 TODO - Server-Side (CRITICAL)

### Step 1: Run Database Migration

**Open Supabase SQL Editor and run:**
```bash
# File: database/add-trace-id.sql
```

This adds `trace_id` to orders tables.

### Step 2: Update Checkout API

**File:** `pages/api/checkout/create.js`

**Find the handler function and add at the top:**
```javascript
export default async function handler(req, res) {
  // Extract trace_id
  const trace_id = req.headers['x-trace-id'] || req.body.trace_id || crypto.randomUUID();
  
  console.log('[TRACE] CHECKOUT_API_IN', {
    trace_id,
    method: req.method,
    has_config: !!req.body.config,
    timestamp: new Date().toISOString()
  });
```

**When creating the order, add trace_id:**
```javascript
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    trace_id, // ADD THIS LINE
    // ... existing fields ...
    config_json: req.body.config, // ENSURE CONFIG IS SAVED
  })
  .select()
  .single();

console.log('[TRACE] ORDER_CREATED', {
  trace_id,
  order_id: order.id,
  has_config_json: !!order.config_json,
  config_color: order.config_json?.color
});
```

**When creating Stripe session, add to metadata:**
```javascript
const session = await stripe.checkout.sessions.create({
  metadata: {
    trace_id, // ADD THIS
    order_id: order.id,
    // ... existing metadata ...
  },
  // ... rest of session config ...
});

console.log('[TRACE] STRIPE_SESSION_CREATED', {
  trace_id,
  session_id: session.id,
  order_id: order.id
});
```

### Step 3: Update Webhook Handler

**File:** `pages/api/webhooks/stripe.js`

**Add trace logging:**
```javascript
export default async function handler(req, res) {
  // ... existing webhook verification ...
  
  const event = stripe.webhooks.constructEvent(/* ... */);
  const trace_id = event.data.object.metadata?.trace_id;
  
  console.log('[TRACE] WEBHOOK_IN', {
    trace_id,
    event_id: event.id,
    event_type: event.type,
    timestamp: new Date().toISOString()
  });
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    console.log('[TRACE] WEBHOOK_DATA', {
      trace_id,
      stripe_customer_id: session.customer,
      email: session.customer_details?.email,
      has_metadata: !!session.metadata
    });
    
    // When upserting customer:
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .upsert({ /* ... */ });
    
    console.log('[TRACE] UPSERT_CUSTOMER', {
      trace_id,
      customer_id: customer?.id,
      success: !custError,
      error: custError?.message
    });
    
    // When updating order:
    const { error: orderError } = await supabase
      .from('orders')
      .update({ 
        customer_id: customer.id,
        // ... other fields ...
      })
      .eq('trace_id', trace_id); // USE TRACE_ID TO FIND ORDER
    
    console.log('[TRACE] UPDATE_ORDER', {
      trace_id,
      success: !orderError,
      error: orderError?.message
    });
  }
  
  res.status(200).json({ received: true, trace_id });
}
```

## 🧪 TESTING PROCEDURE

### Step 1: Enable Trace Debug UI

Open in browser:
```
http://localhost:3000/configurator.html?trace=1
```

You should see a black debug panel in bottom-right with:
- Current Trace ID
- Export Logs button
- Recent events

### Step 2: Perform Test Checkout

1. Open configurator with ?trace=1
2. **Change colors** (try different areas)
3. Click "Jetzt kaufen"
4. Complete Stripe checkout (card: 4242 4242 4242 4242)
5. **Before closing browser:** Click "Export Logs" in debug UI

### Step 3: Collect Evidence

**Browser Console Logs:**
```javascript
// Copy the trace_id
const trace_id = UnbreakTrace.getCurrentId();
console.log('Trace ID:', trace_id);

// Export all logs
UnbreakTrace.export();
```

**Server Logs (Vercel):**
Go to Vercel Dashboard → Deployments → [Latest] → Functions

Filter logs by trace_id.

**Database Verification:**
```sql
-- Find order by trace_id
SELECT 
  id,
  trace_id,
  status,
  customer_email,
  config_json->>'color' as color,
  config_json->>'colors' as colors_object,
  config_json
FROM public.orders
WHERE trace_id = '<PASTE_YOUR_TRACE_ID>';

-- Check if customer was created
SELECT *
FROM public.customers
WHERE email = '<checkout_email>'
ORDER BY created_at DESC
LIMIT 5;
```

## 📋 DELIVERABLES CHECKLIST

For each test run, collect:

- [ ] Trace ID (from browser debug UI)
- [ ] Browser console logs (screenshot or copy)
- [ ] Exported trace logs JSON file
- [ ] Network tab screenshot (POST /api/checkout/create)
- [ ] Stripe webhook event screenshot (checkout.session.completed)
- [ ] SQL query results (order by trace_id)
- [ ] SQL query results (customer by email)
- [ ] Admin screenshot (if customer appears)

## 🐛 DEBUGGING COMMANDS

### Browser Console

```javascript
// Get current trace ID
UnbreakTrace.getCurrentId()

// See all logs
UnbreakTrace.getLogs()

// See config snapshots
UnbreakTrace.getSnapshots()

// Export logs to file
UnbreakTrace.export()

// Manually log event
UnbreakTrace.log('MY_TEST', { data: 'test' })

// Log config
UnbreakTrace.logConfig({ color: 'test' }, 'TEST_CONFIG')
```

### SQL Queries

```sql
-- All orders with trace_id
SELECT id, trace_id, status, customer_email, created_at
FROM public.orders
WHERE trace_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Orders missing customer
SELECT id, trace_id, customer_email, stripe_customer_id
FROM public.orders
WHERE customer_email IS NULL
  OR stripe_customer_id IS NULL
ORDER BY created_at DESC;

-- Config color check
SELECT 
  id,
  trace_id,
  config_json->>'color' as single_color,
  jsonb_pretty(config_json->'colors') as colors_object
FROM public.orders
WHERE config_json IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

## 🚨 KNOWN ISSUES TO WATCH FOR

### Issue 1: Colors Always "Petrol"
**Symptom:** `config_json->>'color'` is always "petrol"
**Check:** 
- Browser logs show correct color in CHECKOUT_CONFIG_SNAPSHOT?
- Is config being overwritten before API call?
- Is API receiving correct config?

### Issue 2: Customers Not Created
**Symptom:** No customer row after checkout
**Check:**
- Webhook received? (check Stripe dashboard)
- Webhook logs show UPSERT_CUSTOMER?
- Database error in webhook logs?
- RLS policies allow insert on customers table?

### Issue 3: Config Not Saved
**Symptom:** `config_json` is NULL in database
**Check:**
- API logs show config in ORDER_CREATED?
- Is simple_orders.config_json column present? (run migration)
- Webhook overwriting config_json to NULL?

## 📁 FILES REFERENCE

### Created Files
1. `database/add-trace-id.sql` - Schema migration
2. `public/configurator/trace-system.js` - Trace client library
3. `TRACE-IMPLEMENTATION-GUIDE.md` - Full implementation guide
4. `TRACE-QUICK-START.md` - This file

### Modified Files
1. ✅ `public/configurator.html` - Added trace-system.js script
2. ✅ `public/checkout.js` - Added trace logging (partial)
3. ⏳ `pages/api/checkout/create.js` - Needs trace_id integration
4. ⏳ `pages/api/webhooks/stripe.js` - Needs trace logging
5. ⏳ `pages/admin/orders/[id].js` - Should show trace_id

## 🎯 SUCCESS CRITERIA

A successful trace should show:

1. **Browser:** 
   - Config changes logged
   - Color changes logged  
   - Checkout initiated with correct config
   
2. **Server:**
   - API received config with trace_id
   - Order created with trace_id + config_json
   - Stripe session created with trace_id in metadata
   
3. **Webhook:**
   - Event received with trace_id
   - Customer upserted
   - Order updated with customer_id
   
4. **Database:**
   - Order exists with trace_id
   - config_json contains correct colors
   - Customer exists and linked
   
5. **Admin UI:**
   - Customer appears in list
   - Order shows customer details
   - Config visible in order detail

---

**Next Step:** Run database migration, then update API routes with trace logging.
