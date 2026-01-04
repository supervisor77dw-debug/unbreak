# E2E TEST PROTOCOL - MANUAL EXECUTION GUIDE
**Status:** READY TO EXECUTE  
**Prerequisite:** Migrations executed, ENV keys copied, dev server running

---

## 📋 TEST RUN #1: GUEST CHECKOUT (Configured Product)

### Pre-Test Setup
- [ ] Server running: `npm run dev` on port 3000
- [ ] Browser: Chrome/Edge with DevTools open (Console + Network tab)
- [ ] Supabase Dashboard: Open in separate tab (SQL Editor ready)
- [ ] Stripe Dashboard: Open in separate tab (Events → Filter: checkout.session.completed)

### Step 1: Open Configurator with Trace
**Action:**
```
http://localhost:3000/configurator.html?trace=1
```

**Expected:**
- ✅ Page loads
- ✅ Debug panel visible (black box, bottom-right)
- ✅ Shows: "Current Trace ID: [UUID]"
- ✅ Console shows: `[TRACE] checkout_page_load`

**Screenshot Required:** `01-configurator-loaded.png`

**Evidence:**
```javascript
// Browser Console - Copy this output:
window.UnbreakTrace.getCurrentId()
// Result: "abc-123-xyz-..." → THIS IS YOUR TRACE_ID
```

---

### Step 2: Configure Colors
**Action:**
1. Change Base color → Select "Graphite"
2. Change Top color → Select "Anthracite"  
3. Change Middle color → Select "Steel"

**Expected Console Logs:**
```
[TRACE] colorChanged - {area: "base", color: "graphite", ...}
[TRACE] colorChanged - {area: "top", color: "anthracite", ...}
[TRACE] colorChanged - {area: "middle", color: "steel", ...}
```

**Screenshot Required:** `02-colors-selected.png` (showing 3D preview with selected colors)

**Evidence:**
```javascript
// Browser Console:
window.UnbreakTrace.getLogs().filter(l => l.eventType === 'colorChanged')
// Should show 3 entries with different colors
```

---

### Step 3: Export Trace Logs (BEFORE Checkout)
**Action:**
- Click "Export Logs" button in debug panel
- Save file as: `trace-[TRACE_ID]-pre-checkout.json`

**Expected:**
- ✅ JSON file downloads
- ✅ Contains colorChanged events
- ✅ Contains config snapshots with {colors: {base, top, middle}}

**File Required:** `trace-[TRACE_ID]-pre-checkout.json`

---

### Step 4: Click "Jetzt kaufen"
**Action:**
- Click buy button
- **WAIT** for Stripe Checkout to load (don't fill yet!)

**Expected Console Logs:**
```
[TRACE] CHECKOUT_CONFIG_SNAPSHOT - {colors: {base: "graphite", top: "anthracite", middle: "steel"}, ...}
[TRACE] CHECKOUT_API_CALL - {endpoint: "/api/checkout/create", ...}
[TRACE] CHECKOUT_API_SUCCESS - {order_id: "...", has_checkout_url: true}
[TRACE] CHECKOUT_REDIRECT - {url: "https://checkout.stripe.com/...", ...}
```

**Screenshot Required:** `03-checkout-initiated.png` (Console showing all [TRACE] logs)

**Network Tab Evidence:**
- Find: `POST /api/checkout/create`
- Headers tab: Check for `X-Trace-ID: [your-trace-id]`
- Request tab: Verify `trace_id` in body
- Response tab: Verify `order_id` returned

**Screenshot Required:** `04-network-request.png` (showing request with trace_id)

---

### Step 5: Complete Payment
**Action:**
1. Fill Stripe Checkout form:
   - Email: `test-[timestamp]@unbreak.test` (e.g., `test-1704384000@unbreak.test`)
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Name: `Test User`
2. Click "Pay"

**Expected:**
- ✅ Payment processes
- ✅ Redirects to success page
- ✅ Stripe shows "Payment succeeded"

**Screenshot Required:** `05-payment-success.png`

**Record Test Data:**
```
TRACE_ID: [from Step 1]
EMAIL: [from payment form]
TIMESTAMP: [current ISO timestamp]
```

---

### Step 6: Export Final Trace Logs
**Action:**
- If still on success page: Click browser back
- Or reopen configurator?trace=1
- Click "Export Logs" again
- Save as: `trace-[TRACE_ID]-complete.json`

**Expected:**
- ✅ File contains complete flow
- ✅ All events: config → API → response → redirect

**File Required:** `trace-[TRACE_ID]-complete.json`

---

### Step 7: Verify Server Logs (Vercel)
**Action:**
1. Go to Vercel Dashboard → Deployments → Latest → Functions
2. Filter logs by: `[TRACE]`
3. Search for your TRACE_ID

**Expected Logs:**
```
[TRACE] CHECKOUT_API_IN - {trace_id: "...", has_config: true, ...}
[TRACE] ORDER_CREATED - {trace_id: "...", order_id: "...", config_color: undefined, config_colors: {base, top, middle}, ...}
[TRACE] STRIPE_SESSION_CREATED - {trace_id: "...", session_id: "cs_...", ...}

[TRACE] WEBHOOK_IN - {trace_id: "...", event_type: "checkout.session.completed", ...}
[TRACE] WEBHOOK_SESSION_DATA - {trace_id: "...", email: "test-...@unbreak.test", ...}
[TRACE] CUSTOMER_SYNC_START - {trace_id: "...", stripe_customer_id: "cus_...", ...}
[TRACE] CUSTOMER_UPSERT_SUCCESS - {trace_id: "...", customer_id: "...", ...}
[TRACE] ORDER_CUSTOMER_LINK_SUCCESS - {trace_id: "...", order_id: "...", customer_id: "..."}
```

**Screenshot Required:** `06-vercel-logs.png` (showing all [TRACE] entries)

---

### Step 8: Verify Stripe Webhook
**Action:**
1. Go to Stripe Dashboard → Events
2. Find most recent: `checkout.session.completed`
3. Click event → Webhooks tab

**Expected:**
- ✅ Webhook sent to your endpoint
- ✅ Response: 200 OK
- ✅ Response body: `{"received": true, "trace_id": "..."}`
- ✅ Metadata contains: `trace_id`, `order_id`

**Screenshot Required:** `07-stripe-webhook.png` (Event details + Webhook delivery)

---

### Step 9: SQL Verification
**Action:**
1. Open Supabase Dashboard → SQL Editor
2. Copy queries from `SQL-VERIFICATION-QUERIES.sql`
3. Replace `<TRACE_ID>` with your actual trace_id
4. Replace `<EMAIL>` with your test email
5. Execute each query

**Required Queries:**
```sql
-- Query 1: Find Order by Trace ID
SELECT id, trace_id, customer_email, customer_id, 
       config_json->'colors' as colors, jsonb_pretty(config_json)
FROM public.simple_orders
WHERE trace_id = '[YOUR_TRACE_ID]';
```

**Expected Result:**
| id | trace_id | customer_email | customer_id | colors | config_json |
|----|----------|----------------|-------------|--------|-------------|
| 123 | abc-... | test@... | uuid-... | {"base":"graphite","top":"anthracite",...} | {...} |

**PASS Criteria:**
- ✅ `trace_id` matches
- ✅ `customer_email` = your test email
- ✅ `customer_id` IS NOT NULL
- ✅ `colors` shows GRAPHITE/ANTHRACITE (NOT "petrol"!)

```sql
-- Query 2: Find Customer
SELECT id, email, stripe_customer_id, name
FROM public.customers
WHERE email = '[YOUR_EMAIL]';
```

**Expected Result:**
| id | email | stripe_customer_id | name |
|----|-------|-------------------|------|
| 456 | test@... | cus_... | Test User |

**PASS Criteria:**
- ✅ Row exists
- ✅ `stripe_customer_id` starts with "cus_"

```sql
-- Query 3: Verify Link
SELECT o.id, o.trace_id, o.customer_id, c.email, c.stripe_customer_id
FROM public.simple_orders o
LEFT JOIN public.customers c ON o.customer_id = c.id
WHERE o.trace_id = '[YOUR_TRACE_ID]';
```

**Expected Result:**
| id | trace_id | customer_id | email | stripe_customer_id |
|----|----------|-------------|-------|-------------------|
| 123 | abc-... | 456 | test@... | cus_... |

**PASS Criteria:**
- ✅ Join successful (customer data visible)
- ✅ IDs match between tables

**Screenshot Required:** `08-sql-results.png` (All 3 query results)

---

### Step 10: Verify Admin UI
**Action:**
1. Open: `http://localhost:3000/admin/customers`
2. Find your test customer by email

**Expected:**
- ✅ Customer appears in list
- ✅ Email matches
- ✅ Name = "Test User"

**Screenshot Required:** `09-admin-customers.png`

**Action:**
3. Open: `http://localhost:3000/admin/orders`
4. Find your test order (search by email or order ID)
5. Click to open order detail

**Expected:**
- ✅ Order appears
- ✅ Customer info visible
- ✅ Config visible (ideally with colors shown)
- ✅ trace_id visible (in debug section)

**Screenshot Required:** `10-admin-order-detail.png`

---

## 📊 TEST RUN #1 RESULTS

### Deliverables Checklist
- [ ] 10 Screenshots (01-10)
- [ ] 2 JSON files (pre-checkout + complete)
- [ ] SQL query results (copy-paste to text file)
- [ ] Test data recorded:
  ```
  TRACE_ID: _________________________
  EMAIL: _________________________
  TIMESTAMP: _________________________
  ORDER_ID (from SQL): _________________________
  CUSTOMER_ID (from SQL): _________________________
  STRIPE_CUSTOMER_ID: _________________________
  ```

### Pass/Fail Criteria
- [ ] ✅ Trace ID flows through all systems
- [ ] ✅ Colors are GRAPHITE/ANTHRACITE (NOT petrol)
- [ ] ✅ Customer record created
- [ ] ✅ Order linked to customer
- [ ] ✅ Webhook delivered with 200 OK
- [ ] ✅ Admin shows customer + order

**Result:** PASS ✅ / FAIL ❌

**If FAIL, attach error logs/screenshots and describe issue:**
```
Issue: _________________________
Expected: _________________________
Actual: _________________________
Logs: _________________________
```

---

## 📋 TEST RUN #2: VARIATION TEST (Different Colors)

Repeat Test Run #1 with different colors:
- Base: **Anthracite**
- Top: **Graphite**
- Middle: **Petrol** (to verify petrol is now a CHOICE, not forced default)

**Expected:**
- config_json shows: `{base: "anthracite", top: "graphite", middle: "petrol"}`
- SQL confirms: Colors match selection
- NOT all areas forced to "petrol"

---

## 🎯 FINAL ACCEPTANCE

Both Test Runs must PASS all criteria.

**Sign-Off:**
```
Test Run #1: PASS ✅ / FAIL ❌
Test Run #2: PASS ✅ / FAIL ❌

Tested By: _________________________
Date: _________________________
Duration: _________ minutes

Notes:
_________________________
_________________________
```

---

## 🐛 DEBUGGING GUIDE

If Test FAILS:

### Problem: Colors still "Petrol"
**Check:**
1. Browser console: What does `CHECKOUT_CONFIG_SNAPSHOT` show?
2. Network tab: Request body `config` field - does it have `colors` object?
3. Vercel logs: `ORDER_CREATED` - what's in `config_colors`?
4. SQL: `config_json->'colors'` - what does it show?

**Fix:**
- If browser has correct colors but DB has petrol → Check API route
- If browser has petrol → Check postMessage handler in checkout.js

### Problem: Customer not created
**Check:**
1. Stripe Dashboard: Did webhook fire?
2. Vercel logs: Do you see `CUSTOMER_UPSERT_SUCCESS`?
3. If no: Check `CUSTOMER_UPSERT_ERROR` - what's the error?

**Fix:**
- Column missing error → Run migrations
- RLS policy error → Update policy to allow service role INSERT

### Problem: No trace_id in database
**Check:**
1. Migration executed? Run: `SELECT column_name FROM information_schema.columns WHERE table_name='simple_orders' AND column_name='trace_id';`
2. If empty → Run `database/add-trace-id.sql`

---

## 📁 FILES TO SUBMIT

After BOTH test runs:

```
logs/
  test-run-1/
    01-configurator-loaded.png
    02-colors-selected.png
    03-checkout-initiated.png
    04-network-request.png
    05-payment-success.png
    06-vercel-logs.png
    07-stripe-webhook.png
    08-sql-results.png
    09-admin-customers.png
    10-admin-order-detail.png
    trace-[TRACE_ID]-pre-checkout.json
    trace-[TRACE_ID]-complete.json
    test-results.txt (pass/fail + data)
  
  test-run-2/
    (same structure)
  
  FINAL-TEST-REPORT.md (summary of both runs)
```

---

**ESTIMATED TIME:** 30-45 minutes per test run  
**TOTAL TIME:** ~90 minutes for complete E2E validation
