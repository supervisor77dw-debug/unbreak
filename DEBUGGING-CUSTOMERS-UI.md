## 🔍 DEBUGGING CHECKLIST - Admin UI zeigt 0/leer

### STEP 0: BEWEIS sammeln (PFLICHT - User muss tun)

**User Action Required:**
1. Öffne https://unbreak-one.vercel.app/admin/customers in Chrome
2. DevTools → Network Tab → Filter: "customers"
3. Reload Page (Ctrl+R)
4. Rechtsklick auf `/api/admin/customers` Request → Copy → Copy as cURL
5. Poste hier:
   - **Request URL** (vollständig)
   - **Response JSON** (mindestens 1 Customer, z.B. dirk@ricks-kiel.de)

**Warum wichtig:**
- Ich sehe ob Vercel den Fix deployed hat
- Ich sehe ob API die richtigen Daten liefert
- Ich sehe ob UI die richtigen Felder liest

---

### UI CONTRACT (ALREADY CORRECT ✅)

File: [pages/admin/customers/index.js](pages/admin/customers/index.js#L159-L165)

```javascript
<td>
  <span className="badge">{customer.total_orders}</span>  {/* ✅ Line 159 */}
</td>
<td className="currency">
  {customer.total_spent_cents > 0 ? formatCurrency(customer.total_spent_cents) : '€0.00'}  {/* ✅ Line 161-162 */}
</td>
<td className="date-cell">
  {formatDate(customer.last_order_at)}  {/* ✅ Line 164-165 */}
</td>
```

**UI liest EXAKT die Felder die API liefert:**
- `customer.total_orders` ✅
- `customer.total_spent_cents` ✅
- `customer.last_order_at` ✅

---

### API FIX (ALREADY COMMITTED ✅)

File: [pages/api/admin/customers.js](pages/api/admin/customers.js#L44-L75)

**Commit:** `f6f5dfe` - FIX: Customer List API - Calculate stats with email fallback

**Fix Summary:**
- Changed from reading `customer.total_orders` (doesn't exist in DB)
- To CALCULATING stats via JOIN on `orders` + `simple_orders`
- Uses OR fallback: `customer_id` OR `customer_email`

**Code:**
```javascript
const formattedCustomers = await Promise.all(customers.map(async (customer) => {
  // Get orders with fallback: customer_id OR email
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('total_cents, created_at')
    .or(`customer_id.eq.${customer.id},customer_email.ilike.${customer.email}`);

  const { data: simpleOrders } = await supabaseAdmin
    .from('simple_orders')
    .select('total_amount_cents, created_at')
    .or(`customer_id.eq.${customer.id},customer_email.ilike.${customer.email}`);

  const allOrders = [...(orders || []), ...(simpleOrders || [])];
  const totalOrders = allOrders.length;
  const totalSpentCents = allOrders.reduce((sum, order) => {
    return sum + (order.total_cents || order.total_amount_cents || 0);
  }, 0);
  const lastOrderAt = allOrders.length > 0 
    ? allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
    : null;

  return {
    // ...
    total_orders: totalOrders,
    total_spent_cents: totalSpentCents,
    total_spent_eur: (totalSpentCents / 100).toFixed(2),
    last_order_at: lastOrderAt,
    // ...
  };
}));
```

---

### DEPLOYMENT STATUS (CHECK NEEDED)

**Pushed to GitHub:** ✅ Commit `f6f5dfe` @ Jan 7, 2026

**Vercel Deployment:**
- Auto-deploy triggered ✅
- Deploy URL: https://unbreak-one.vercel.app
- Status: **UNKNOWN** (need to verify)

**How to verify:**
1. Go to https://vercel.com/supervisor77dw-debug/unbreak → Deployments
2. Check latest deployment status (should be "Ready")
3. Check deployment commit SHA matches `f6f5dfe`

---

### MÖGLICHE URSACHEN (wenn Fix nicht wirkt)

#### 1. Vercel Deployment noch nicht live
- **Check:** Vercel Dashboard → Latest Deployment → Status = "Ready"?
- **Fix:** Wait 2-3 minutes, hard-refresh (Ctrl+Shift+R)

#### 2. Browser Cache
- **Symptom:** UI code alt, API code neu
- **Fix:** Hard Refresh (Ctrl+Shift+R) oder Incognito

#### 3. Supabase RLS Policies blockieren Query
- **Symptom:** API Query returns empty array
- **Check:** Supabase Dashboard → SQL Editor → Run:
  ```sql
  SELECT 
    c.email,
    COUNT(o.id) as order_count
  FROM customers c
  LEFT JOIN simple_orders o ON (
    o.customer_id = c.id 
    OR lower(o.customer_email) = lower(c.email)
  )
  WHERE c.email = 'dirk@ricks-kiel.de'
  GROUP BY c.email;
  ```
  Expected: `order_count = 20`

#### 4. API Error (500)
- **Symptom:** Network Tab shows 500 error
- **Check:** Vercel Logs → Runtime Logs
- **Look for:** Prisma/Supabase connection errors

---

### NEXT STEPS (PRIORITIZED)

**DO FIRST (User Action):**
1. ✅ Hard refresh Admin page (Ctrl+Shift+R)
2. ✅ Check Network Tab JSON response
3. ✅ Post JSON response here

**IF STILL 0/NULL (Debugging):**
1. Check Vercel Deployment status
2. Check Vercel Runtime Logs for errors
3. Test API endpoint directly:
   ```bash
   curl https://unbreak-one.vercel.app/api/admin/customers \
     -H "Cookie: [your-session-cookie]"
   ```

**IF API WORKS BUT UI DOESN'T (Contract Mismatch):**
1. Re-check UI code field names
2. Add console.log in UI to see raw API response
3. Check for TypeScript/PropTypes mismatch

---

### EXPECTED RESULTS (After Fix)

**API Response** (`/api/admin/customers`):
```json
{
  "success": true,
  "customers": [
    {
      "id": "e178f38c-6ccd-4e7c-9091-e0879e5ef707",
      "email": "dirk@ricks-kiel.de",
      "name": "Dirk",
      "phone": null,
      "stripe_customer_id": "cus_TjMr1v0yoE4noB",
      "total_orders": 20,              // ✅ NOT 0
      "total_spent_cents": 146150,     // ✅ NOT 0
      "total_spent_eur": "1461.50",
      "last_order_at": "2026-01-06T18:44:30.845168Z",  // ✅ NOT null
      "created_at": "2025-12-30T18:22:42.662921Z",
      "updated_at": "2025-12-30T18:22:42.662921Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

**UI Display:**
- Bestellungen: **20** (not 0)
- Umsatz: **€1,461.50** (not €0.00)
- Letzte Bestellung: **06.01.2026** (not —)

---

## USER ACTION REQUIRED

**Poste hier:**
1. Screenshot von Network Tab (Request + Response für `/api/admin/customers`)
2. Oder copy/paste der Response JSON
3. Vercel Deployment Status (Ready/Building/Failed)

**Ohne diese Beweise kann ich nicht weiter debuggen!**
