# UNBREAK ONE - E2E TRACE IMPLEMENTATION GUIDE

## Status: READY TO IMPLEMENT

### Phase 1: Database Schema ✅
**File:** `database/add-trace-id.sql`
- Adds `trace_id` to `orders` and `simple_orders` tables
- **ACTION REQUIRED:** Run in Supabase SQL Editor

### Phase 2: Client-Side Tracing ✅
**File:** `public/configurator/trace-system.js`
- Complete trace system with UUID generation
- sessionStorage persistence
- Export functionality
- Debug UI (add ?trace=1 to URL)

### Phase 3: Integration Points (TODO)

#### 3.1 configurator.html
**Add before closing `</body>`:**
```html
<!-- Trace System -->
<script src="configurator/trace-system.js"></script>
```

#### 3.2 checkout.js Integration
**At top of file, after console.log('🚀 [CHECKOUT]...'):**
```javascript
// Initialize trace if available
if (typeof window.UnbreakTrace !== 'undefined') {
    window.UnbreakTrace.start('checkout_page_load');
}
```

**In buyConfigured() function, at start:**
```javascript
async buyConfigured(config, clickEvent = null) {
    // START TRACE
    const trace_id = window.UnbreakTrace ? window.UnbreakTrace.start('checkout_configured') : null;
    
    if (window.UnbreakTrace) {
        window.UnbreakTrace.logConfig(config, 'CHECKOUT_CONFIG_SNAPSHOT');
    }
    
    console.log('🛒 [CHECKOUT] Configured button clicked!', {
        trace_id,
        config,
        timestamp: new Date().toISOString()
    });
```

**In buyConfigured(), before fetch:**
```javascript
// Log before API call
if (window.UnbreakTrace) {
    window.UnbreakTrace.log('CHECKOUT_API_CALL', {
        endpoint: '/api/checkout/create',
        product_sku: sku,
        config_hash: JSON.stringify(config).substring(0, 50)
    });
}

// Call checkout API
const response = await fetch('/api/checkout/create', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Trace-ID': trace_id || 'no-trace' // Send trace_id to server
    },
    body: JSON.stringify({
        trace_id, // Include in body
        product_sku: sku,
        config: config,
        // ...rest
    }),
});
```

### Phase 4: Server-Side Integration (TODO)

#### 4.1 API Route: pages/api/checkout/create.js
**Add trace logging:**
```javascript
export default async function handler(req, res) {
    const trace_id = req.headers['x-trace-id'] || req.body.trace_id || crypto.randomUUID();
    
    console.log('[TRACE] CHECKOUT_API_IN', {
        trace_id,
        method: req.method,
        body_keys: Object.keys(req.body),
        timestamp: new Date().toISOString()
    });
    
    try {
        // ... existing code ...
        
        // When creating order:
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                trace_id, // ADD THIS
                // ...existing fields
            });
        
        console.log('[TRACE] ORDER_CREATED', {
            trace_id,
            order_id: order.id,
            config_json: order.config_json ? 'present' : 'missing'
        });
        
        // When creating Stripe session:
        const session = await stripe.checkout.sessions.create({
            metadata: {
                trace_id, // ADD THIS
                order_id: order.id,
                // ...existing metadata
            },
            // ...rest
        });
        
        console.log('[TRACE] STRIPE_SESSION_CREATED', {
            trace_id,
            session_id: session.id,
            order_id: order.id
        });
        
    } catch (error) {
        console.error('[TRACE] CHECKOUT_API_ERROR', {
            trace_id,
            error: error.message,
            stack: error.stack
        });
    }
}
```

#### 4.2 Webhook: pages/api/webhooks/stripe.js
**Add trace logging:**
```javascript
export default async function handler(req, res) {
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
            session_id: session.id
        });
        
        // Upsert customer
        const { data: customer, error } = await supabase
            .from('customers')
            .upsert({ /* ... */ });
        
        console.log('[TRACE] UPSERT_CUSTOMER', {
            trace_id,
            customer_id: customer?.id,
            upsert_ok: !error,
            error: error?.message
        });
        
        // Update order
        await supabase
            .from('orders')
            .update({ /* ... */ })
            .eq('trace_id', trace_id);
        
        console.log('[TRACE] UPDATE_ORDER', {
            trace_id,
            updated_fields: ['customer_id', 'stripe_customer_id', 'status']
        });
    }
    
    res.status(200).json({ received: true, trace_id });
}
```

### Phase 5: Configurator Integration (TODO)

#### 5.1 configurator.js
**Add after receiving config from iframe:**
```javascript
// In message handler for 'UNBREAK_CONFIG_UPDATE'
if (event.data.type === 'UNBREAK_CONFIG_UPDATE') {
    const config = event.data.config;
    
    // Log config change
    if (window.UnbreakTrace) {
        window.UnbreakTrace.logConfig(config, 'IFRAME_CONFIG_UPDATE');
    }
    
    window.UnbreakCheckoutState.lastConfig = config;
}
```

**Add color change logging:**
```javascript
// If you have access to color change events from iframe:
window.addEventListener('message', (event) => {
    if (event.data.type === 'colorChanged') {
        if (window.UnbreakTrace) {
            window.UnbreakTrace.logColorChange(
                event.data.areaKey,
                event.data.colorValue,
                event.data.fullConfig
            );
        }
    }
});
```

### Phase 6: Admin UI (TODO)

#### 6.1 pages/admin/orders/[id].js
**Add trace_id display:**
```jsx
<div className="order-detail">
    <h2>Order Details</h2>
    
    {/* ADD THIS */}
    {order.trace_id && (
        <div className="trace-info">
            <strong>Trace ID:</strong> 
            <code>{order.trace_id}</code>
            <button onClick={() => {
                navigator.clipboard.writeText(order.trace_id);
                alert('Trace ID copied!');
            }}>
                Copy
            </button>
        </div>
    )}
    
    {/* Existing fields */}
</div>
```

### Phase 7: Testing Workflow

#### Test 1: Fresh Checkout
1. Open: http://localhost:3000/configurator.html?trace=1
2. See debug UI in bottom right
3. Change colors multiple times
4. Click "Jetzt kaufen"
5. Complete Stripe checkout (use test card: 4242 4242 4242 4242)
6. Check trace logs:
   - Browser console
   - Click "Export Logs" in debug UI
   - Server logs (Vercel or local)

#### Test 2: Verify Database
```sql
-- Find order by trace_id
SELECT id, trace_id, status, customer_email, config_json
FROM public.orders
WHERE trace_id = '<PASTE_TRACE_ID>';

-- Verify customer was created
SELECT *
FROM public.customers
WHERE email = '<checkout_email>';
```

#### Test 3: Verify Config Colors
```sql
-- Check if colors are saved correctly
SELECT 
    id,
    trace_id,
    config_json->>'color' as color,
    config_json->>'colors' as colors_object,
    config_json
FROM public.orders
WHERE trace_id = '<PASTE_TRACE_ID>';
```

### Expected Output Example

**Browser Console:**
```
[TRACE] TRACE_START { trace_id: "abc-123...", context: "checkout_page_load" }
[TRACE] IFRAME_CONFIG_UPDATE { trace_id: "abc-123...", colors: {base: "graphite", ...} }
[TRACE] CONFIG_COLOR_CHANGE { trace_id: "abc-123...", area: "base", color: "graphite" }
[TRACE] CHECKOUT_CONFIG_SNAPSHOT { trace_id: "abc-123...", config_summary: {...} }
[TRACE] CHECKOUT_API_CALL { trace_id: "abc-123...", endpoint: "/api/checkout/create" }
```

**Server Logs (Vercel/Local):**
```
[TRACE] CHECKOUT_API_IN { trace_id: "abc-123...", timestamp: "2026-01-04..." }
[TRACE] ORDER_CREATED { trace_id: "abc-123...", order_id: "uuid-..." }
[TRACE] STRIPE_SESSION_CREATED { trace_id: "abc-123...", session_id: "cs_test_..." }
[TRACE] WEBHOOK_IN { trace_id: "abc-123...", event_id: "evt_..." }
[TRACE] UPSERT_CUSTOMER { trace_id: "abc-123...", customer_id: "uuid-..." }
[TRACE] UPDATE_ORDER { trace_id: "abc-123...", updated_fields: [...] }
```

### Deliverables Checklist

- [ ] Run `database/add-trace-id.sql` in Supabase
- [ ] Add trace-system.js to configurator.html
- [ ] Update checkout.js with trace logging
- [ ] Update checkout API with trace_id
- [ ] Update webhook with trace logging
- [ ] Update admin UI to show trace_id
- [ ] Perform test checkout
- [ ] Export trace logs
- [ ] SQL verification queries
- [ ] Screenshot: Network tab (checkout API request/response)
- [ ] Screenshot: Stripe webhook event
- [ ] Screenshot: Admin order detail with trace_id
- [ ] Log file: Full trace from test run

### Debug Commands

```javascript
// Browser console:
UnbreakTrace.getCurrentId()              // Get current trace ID
UnbreakTrace.getLogs()                    // See all logs
UnbreakTrace.export()                     // Download logs
UnbreakTrace.getSnapshots()              // See config snapshots

// Start manual trace:
UnbreakTrace.start('manual_test')

// Log custom event:
UnbreakTrace.log('CUSTOM_EVENT', { my: 'data' })
```

### Files Created
1. ✅ `database/add-trace-id.sql` - Schema migration
2. ✅ `public/configurator/trace-system.js` - Client-side tracing
3. ✅ `TRACE-IMPLEMENTATION-GUIDE.md` - This file

### Files to Modify
- [ ] `public/configurator.html` - Add trace-system.js script
- [ ] `public/checkout.js` - Add trace logging
- [ ] `pages/api/checkout/create.js` - Add trace_id to order creation
- [ ] `pages/api/webhooks/stripe.js` - Add trace logging
- [ ] `pages/admin/orders/[id].js` - Show trace_id in UI

### Next Steps
1. Run SQL migration
2. Integrate trace-system.js into HTML
3. Update checkout.js (see Phase 3.2)
4. Update API routes (see Phase 4)
5. Test complete flow
6. Document findings

---

**Status:** Implementation guide complete. Ready for execution.
**Estimated Time:** 2-3 hours for full implementation
**Priority:** HIGH - Needed for debugging color/customer issues
