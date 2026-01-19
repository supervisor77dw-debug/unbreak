# HOTFIX: Event-Deduplizierung funktioniert nicht

## Problem
- `stripe_event_id` ist NULL in allen `admin_order_events` Rows
- `event_type` ist NULL in allen Rows
- **Grund**: Spalte `stripe_event_id` existiert nicht in Production DB
- **Impact**: Duplicate Events werden NICHT erkannt → doppelte Order-Verarbeitung

## Root Cause
1. Migration SQL existiert (`20260119_add_event_idempotency_and_email_flags.sql`)
2. Aber wurde **NIE auf Production ausgeführt**
3. Zusätzlich: EventType Enum fehlt `EMAIL_BLOCKED` Value

## Solution

### 1. EventType Enum erweitert
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

### 2. Migration SQL erstellt
Datei: `HOTFIX-EVENT-DEDUP.sql`

Diese SQL:
- ✅ Erweitert EventType enum um EMAIL_BLOCKED
- ✅ Fügt `stripe_event_id` Spalte hinzu
- ✅ Erstellt UNIQUE Index auf `stripe_event_id`
- ✅ Fügt Email-Tracking Felder hinzu (`customer_email_sent_at`, `admin_email_sent_at`)
- ✅ Erstellt Indexes für Email-Queries

### 3. Ausführung auf Production

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
# [EVENT_DEDUP_OK] event_id=evt_xxx type=checkout.session.completed

# Check DB:
SELECT stripe_event_id, type, source, created_at
FROM admin_order_events
WHERE stripe_event_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

# Expected: stripe_event_id should contain evt_xxx values
```

### 5. Test Duplicate Rejection

```bash
# Send same event TWICE (simulate retry)

# First: [EVENT_DEDUP_OK] event_id=evt_xxx
# Second: [EVENT_DUPLICATE] event_id=evt_xxx - Already processed
```

## Files Changed

### Code
- ✅ `prisma/schema.prisma`: EventType enum erweitert um EMAIL_BLOCKED
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
