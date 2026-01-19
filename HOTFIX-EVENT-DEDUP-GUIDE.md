# HOTFIX: Event-Deduplizierung funktioniert nicht

## Problem
- `stripe_event_id` ist NULL in **ALLEN** `admin_order_events` Rows
- `event_type` fehlt komplett (sollte z.B. "checkout.session.completed" enthalten)
- **Grund**: Spalten existieren nicht in Production DB
- **Impact**: Duplicate Events werden NICHT erkannt → doppelte Order-Verarbeitung

## Root Cause
1. Spalte `stripe_event_id` existiert nicht in DB
2. Spalte `event_type` existiert nicht in DB
3. Payload war zu minimal (nur type, livemode, created statt FULL event object)

## Solution

### 1. Schema erweitert ([prisma/schema.prisma](prisma/schema.prisma#L158-L172))

**EventType Enum:**
```diff
enum EventType {
  STRIPE_WEBHOOK
  RESEND_SEND
  STATUS_CHANGE
  NOTE_ADDED
+ EMAIL_BLOCKED
  ERROR
}
```

**OrderEvent Model:**
```diff
model OrderEvent {
  id            String    @id @default(uuid())
  orderId       String?   @map("order_id")
  stripeEventId String?   @unique @map("stripe_event_id")
+ eventType     String?   @map("event_type")  // Stripe event type
  type          EventType
  source        String
  payload       Json
### 3. Migration SQL ([HOTFIX-EVENT-DEDUP.sql](HOTFIX-EVENT-DEDUP.sql))

Diese SQL:
- ✅ Erweitert EventType enum um EMAIL_BLOCKED
- ✅ Fügt `stripe_event_id` Spalte hinzu (TEXT)
- ✅ Fügt `event_type` Spalte hinzu (TEXT) 
- ✅ Erstellt UNIQUE Index auf `stripe_event_id`
- ✅ Erstellt Index auf `event_type`
- ✅ Fügt Email-Tracking Felder hinzu (`customer_email_sent_at`, `admin_email_sent_at`)
- ✅ Erstellt Indexes für Email-Queries

---

## ⚡ JETZT AUSFÜHREN in Supabase SQL Editor

Öffne [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new) und kopiere die komplette SQL aus [HOTFIX-EVENT-DEDUP.sql](HOTFIX-EVENT-DEDUP.sql):

**Oder direkt hier
```

### 2. Webhook Code gefixt ([pages/api/webhooks/stripe.js](pages/api/webhooks/stripe.js#L118-L140))

**Vorher:**
```javascript
await prisma.orderEvent.create({
  data: {
    stripeEventId: event.id,
    type: 'STRIPE_WEBHOOK',
    payload: { type: event.type, livemode: event.livemode, created: event.created }
  }
});
```

**Nachher:**
```javascript
await prisma.orderEvent.create({
  data: {
    stripeEventId: event.id,          // evt_xxx
    eventType: event.type,             // checkout.session.completed
    type: 'STRIPE_WEBHOOK',            // EventType enum
    source: 'stripe',
    payload: event                     // FULL event object
  }
});
```

**JETZT IN SUPABASE SQL EDITOR:**

```sql
-- In Supabase: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

-- 1. Run HOTFIX-EVENT-DEDUP.sql
\i HOTFIX-EVENT-DEDUP.sql

-- 2. Verify stripe_event_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_order_events' 
  AND column_name = 'stripe_event_id';

-- Expected: stripe_event_id | text | YES

-- 3. Verify UNIQUE index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'admin_order_events'
  AND indexname = 'admin_order_events_stripe_event_id_key';

-- Expected: admin_order_events_stripe_event_id_key | CREATE UNIQUE INDEX...

-- 4. Verify EventType enum has EMAIL_BLOCKED
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'EventType'
ORDER BY e.enumsortorder;

-- Expected output should include: EMAIL_BLOCKED
```

### 4. Test Event Deduplication

Nach Migration-Ausführung:

```bash
# Trigger test webhook (Staging)
# Stripe CLI: stripe listen --forward-to https://unbreak-one-staging.vercel.app/api/webhooks/stripe

# Check logs for:
# [EVENT_DEDUP_OK] event_id=evt_xxx event_type=checkout.session.completed

# Check DB:
SELECT stripe_event_id, event_type, type, source, created_at
FROM admin_order_events
WHERE stripe_event_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

# Expected: 
# - stripe_event_id: evt_xxx values (NOT NULL)
# - event_type: checkout.session.completed (NOT NULL)
# - type: STRIPE_WEBHOOK
```

### 5. Test Duplicate Rejection

```bash request:
# [EVENT_DEDUP_OK] event_id=evt_123 event_type=checkout.session.completed

# Second request (duplicate):
# [EVENT_DUPLICATE] event_id=evt_123 event_type=checkout.session.completed - Already processed
# Response: 200 { received: true, duplicate: true }

# First: [EVENT_DEDUP_OK] event_id=evt_xxx
# Second: [EVENT_DUPLICATE] event_id=evt_xxx - Already processed
```

  - EventType enum erweitert um EMAIL_BLOCKED
  - OrderEvent model erweitert um eventType field
- ✅ `pages/api/webhooks/stripe.js`:
  - Event dedup speichert jetzt eventType
  - Payload enthält FULL event object
- ✅ Prisma Client regeneriert (v7.2.0)

### SQL
- ✅ `HOTFIX-EVENT-DEDUP.sql`: Migration für Production
- ✅ `HOTFIX-EVENT-DEDUP-GUIDE.md`: Diese Anleitung

## Commits
- **76d1aaf**: Initial event dedup fix
- **09912f8**: P0 HOTFIX mit event_type field + full payloadm EMAIL_BLOCKED
- ✅ Prisma Client regeneriert (v7.2.0)

### SQL
- ✅ `HOTFIX-EVENT-DEDUP.sql`: Migration für Production

## Next Steps

1. **JETZT**: Migration in Supabase SQL Editor ausführen
2. **VERIFY**: Spalte + Index existieren
3. **TEST**: Webhook triggern, prüfen ob stripe_event_id populated wird
4. **COMMIT**: Schema-Änderung committen
5. **DEPLOY**: Vercel Staging neu deployen (damit neuer Prisma Client aktiv wird)

## Validation Queries

```sql
-- Check if migration succeeded
SELECT 
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'admin_order_events' AND column_name = 'stripe_event_id') as has_stripe_event_id,
  
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE tablename = 'admin_order_events' AND indexname = 'admin_order_events_stripe_event_id_key') as has_unique_index,
  
  (SELECT COUNT(*) FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
   WHERE t.typname = 'EventType' AND e.enumlabel = 'EMAIL_BLOCKED') as has_email_blocked_enum;

-- Expected: 1, 1, 1
```
