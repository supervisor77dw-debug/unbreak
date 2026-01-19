# Stripe Webhook Configuration Guide

## Environment Variables

### Required for Stripe Webhooks

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_xxx  # Test mode: sk_test_xxx
                               # Live mode: sk_live_xxx

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_xxx  # From Stripe Dashboard > Developers > Webhooks

# Database
DATABASE_URL=postgresql://...  # Prisma connection to Supabase
```

### Test vs Live Mode

**CRITICAL:** The webhook secret MUST match the mode of your Stripe events.

- **Test Mode**: Use `sk_test_...` and webhook secret from TEST mode endpoint
- **Live Mode**: Use `sk_live_...` and webhook secret from LIVE mode endpoint

**Common Error:**
```
⚠️ [STRIPE SESSION NOT FOUND] Session does not exist or has expired (cs_test_...)
```
This means: Event is TEST mode but you're using LIVE keys (or vice versa).

## Webhook Events

Configure these events in Stripe Dashboard > Developers > Webhooks:

### Required Events

1. **checkout.session.completed**
   - Triggers: Order creation in `admin_orders`
   - Action: Writes order + items + customer data, sends emails

2. **customer.created** (optional)
   - Tracks customer creation

3. **customer.updated** (optional)
   - Tracks customer updates

### Webhook Endpoint URL

- **Production**: `https://www.unbreak-one.com/api/webhooks/stripe`
- **Staging**: `https://unbreak-one-staging.vercel.app/api/webhooks/stripe`
- **Local Dev**: Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## Event Idempotency

Webhooks are idempotent via `event.id` stored in `admin_order_events.stripe_event_id`:

- First event → Processed
- Duplicate event → Returns 200 OK immediately (logged as duplicate)
- Prevents double orders from Stripe retries

## Test Mode vs Live Mode Detection

The webhook automatically detects mode from `event.livemode`:

```javascript
event.livemode === true  → LIVE mode
event.livemode === false → TEST mode
```

Logs:
```
[MODE] event.livemode=false → TEST
[MODE] event.livemode=true → LIVE
```

## Troubleshooting

### Error: "ReferenceError: event is not defined"
**Fixed in commit xxx** - Event scope properly passed to handlers

### Error: "Session not found" (cs_test_...)
**Cause**: Mode mismatch
**Fix**: 
1. Check `STRIPE_SECRET_KEY` starts with `sk_test_` for test events
2. Check `STRIPE_WEBHOOK_SECRET` is from TEST mode endpoint
3. Or vice versa for live events

### Error: "Event logging failed" (P2002)
**Cause**: Duplicate event (already processed)
**Expected**: Webhook returns 200 OK with `{ duplicate: true }`

### Orders not appearing in admin_orders
**Check**:
1. Vercel logs: Search for `[EMAIL_DB_UPDATED]`
2. Database: `SELECT * FROM admin_order_events WHERE stripe_event_id = 'evt_xxx'`
3. If event exists but order doesn't → Check webhook logs for errors

## Database Schema

### admin_order_events (Event Deduplication)
```sql
stripe_event_id TEXT UNIQUE  -- Stripe event.id
event_type TEXT              -- checkout.session.completed, etc.
type EventType               -- STRIPE_WEBHOOK, ERROR, etc.
payload JSONB                -- Full event object
```

### admin_orders (SSOT)
```sql
stripe_session_id TEXT       -- cs_xxx from Stripe
stripe_customer_id TEXT      -- cus_xxx from Stripe
payment_intent_id TEXT       -- pi_xxx from Stripe
email_status TEXT            -- processing, sent, disabled, error, partial
customer_email_sent_at TIMESTAMP
admin_email_sent_at TIMESTAMP
email_last_error TEXT
```

## Success Page Flow

1. User completes checkout → Redirected to `/success?session_id=cs_xxx`
2. Success page polls `/api/order/by-session?session_id=cs_xxx` every 2 seconds
3. Initial response: `{ found: false, message: "Order is being processed..." }`
4. Once webhook creates order: `{ found: true, order: {...} }`
5. Success page shows: "Order confirmed" with order number

## Monitoring

### Key Log Patterns

**Successful webhook:**
```
[EVENT_DEDUP_OK] event_id=evt_xxx event_type=checkout.session.completed
[EMAIL_FLOW_START] order_id=abc123de
[EMAIL_DB_UPDATE] emailStatus=processing
[EMAIL_ROUTE] customer=test@example.com admin=orders@unbreak-one.com
[EMAIL_SENT_CUSTOMER] resend_id=re_xxx
[EMAIL_SENT_ADMIN] resend_id=re_yyy
[EMAIL_SEND_RESULT] customer=ok admin=ok
[EMAIL_DB_UPDATED] order_id=abc123de status=sent customer_sent=true admin_sent=true
```

**Duplicate webhook:**
```
[EVENT_DUPLICATE] event_id=evt_xxx - Already processed
```

**Expired session (expected):**
```
[STRIPE SESSION NOT FOUND] Session does not exist or has expired
```

### Vercel Logs Queries

- All webhooks: Filter by `[WEBHOOK HIT]`
- Failed webhooks: Filter by `❌ [Webhook]`
- Email issues: Filter by `[EMAIL_ERROR]` or `[EMAIL_DB_UPDATED] status=error`
- Duplicates: Filter by `[EVENT_DUPLICATE]`

## Security

- **Signature Verification**: All webhooks verify Stripe signature before processing
- **Multi-Secret Support**: Supports multiple webhook secrets (separated by `|` or `,`)
- **Service Role Key**: Required for direct DB writes (Supabase)

## Testing

### Test Checklist

1. **New Order** (First time)
   - Trigger test checkout
   - Logs show: `[EVENT_DEDUP_OK]`
   - Order appears in `admin_orders`
   - Emails sent
   - Success page shows order number

2. **Replay** (Duplicate event)
   - Use Stripe CLI: `stripe events resend evt_xxx`
   - Logs show: `[EVENT_DUPLICATE]`
   - No duplicate order created
   - Returns 200 OK

3. **Mode Mismatch** (Test event + Live keys)
   - Send test event to live endpoint
   - Logs show: `[STRIPE SESSION NOT FOUND]`
   - Returns 200 OK (graceful)
   - No order created (expected)

## API Endpoints

### POST /api/webhooks/stripe
Receives Stripe webhook events

### GET /api/order/by-session?session_id=cs_xxx
Returns order status for success page polling
