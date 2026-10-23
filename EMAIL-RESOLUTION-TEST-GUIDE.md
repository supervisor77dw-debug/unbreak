# EMAIL RESOLUTION FIX - Testing Guide
## UNBREAK ONE - Messe Day 2 Emergency Fix

---

## 🎯 FIX OVERVIEW

**PROBLEM:** Order emails NOT sent despite webhook 200 OK

**ROOT CAUSE:** 
- Real Stripe event data:
  - `session.customer_details.email = "dirk@ricks-kiel.de"` ✅ VALID
  - `session.metadata.customer_email = "guest"` ❌ PLACEHOLDER
- Code used simple fallback without email validation
- No BCC for debugging
- No admin notification when email missing

**SOLUTION IMPLEMENTED:**
1. ✅ Email validation helper (`isValidEmail()`)
2. ✅ Priority-based email resolution (customer_details → customer_email → validated metadata)
3. ✅ BCC to `admin@unbreak-one.com` for all order emails
4. ✅ Admin notification when no valid email found
5. ✅ Enhanced logging (email source tracking)

---

## 📋 WHAT WAS CHANGED

### `pages/api/webhooks/stripe.js`
- **Function:** `sendOrderConfirmationEmail()` - Complete rewrite
- **Added:** Email validation helper
- **Added:** Priority-based email resolution with logging
- **Added:** Admin notification fallback
- **Added:** BCC to `admin@unbreak-one.com`

### `lib/email/emailService.ts`
- **Interface:** `SendEmailParams` - Added `bcc?: string | string[]`
- **Function:** `sendOrderConfirmation()` - Added `bcc` parameter
- **Function:** `sendEmail()` - Pass BCC to Resend API

---

## ✅ TESTING CHECKLIST

### Pre-Test Setup
- [ ] Vercel Preview deployment complete
- [ ] Check Vercel Logs accessible
- [ ] Check Resend Dashboard accessible: https://resend.com/emails
- [ ] Check admin@unbreak-one.com inbox accessible

### Test 1: Real Stripe Test Webhook

**Steps:**
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Find webhook endpoint: `https://[preview-url]/api/webhooks/stripe`
3. Click "Send test webhook"
4. Select event: `checkout.session.completed`
5. Check Vercel Logs

**Expected Logs:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [EMAIL RESOLUTION] Determining recipient email...
📧 [EMAIL SOURCE] session.id: cs_test_xxx
📧 [EMAIL SOURCE] session.customer_details?.email: test@example.com
📧 [EMAIL SOURCE] session.customer_email: null
📧 [EMAIL SOURCE] session.metadata?.customer_email: guest
📧 [EMAIL RESOLVED] Recipient: test@example.com
📧 [EMAIL RESOLVED] Source: session.customer_details.email
📧 [EMAIL] Recipient: test@example.com (session.customer_details.email)
📧 [EMAIL] BCC: admin@unbreak-one.com (Messe/Debug)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [EMAIL SUCCESS] Order confirmation sent!
✅ [EMAIL] Resend Email ID: re_abc123xyz
✅ [EMAIL] TO: test@example.com (session.customer_details.email)
✅ [EMAIL] BCC: admin@unbreak-one.com
✅ [EMAIL] Order: ABC12345
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Expected Resend Dashboard:**
- Status: Delivered ✅
- From: `UNBREAK ONE <orders@unbreak-one.com>`
- To: `test@example.com`
- BCC: `admin@unbreak-one.com`
- Reply-To: `support@unbreak-one.com`
- Subject: `Bestellbestätigung - Bestellung #...`

**Expected admin@unbreak-one.com Inbox:**
- Email received (BCC copy)
- Customer email visible in TO field

### Test 2: Real Order (Production-like)

**Steps:**
1. Open: `https://[preview-url]/shop`
2. Add product to cart
3. Checkout with Stripe test card: `4242 4242 4242 4242`
4. Email: `dirk@ricks-kiel.de`
5. Complete payment
6. Check Vercel Logs
7. Check Resend Dashboard
8. Check both inboxes (customer + admin)

**Expected Result:**
- ✅ Webhook returns 200 OK
- ✅ Order marked as paid in database
- ✅ Email sent to customer (`dirk@ricks-kiel.de`)
- ✅ BCC sent to admin (`admin@unbreak-one.com`)
- ✅ Resend shows 2 deliveries
- ✅ Both inboxes receive email

### Test 3: Edge Case - Invalid Email in Metadata

**Scenario:** Order with `metadata.customer_email = "guest"`

**Expected Behavior:**
- Code checks `customer_details.email` first (priority 1)
- If empty, checks `customer_email` (priority 2)
- If empty, validates `metadata.customer_email` (priority 3)
- `"guest"` fails validation (no @ or .)
- Admin notification sent to `admin@unbreak-one.com`

**Expected Logs:**
```
📧 [EMAIL RESOLVED] Recipient: NONE
📧 [EMAIL RESOLVED] Source: NONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  [EMAIL CRITICAL] NO VALID CUSTOMER EMAIL FOUND!
⚠️  [EMAIL] Order ID: xxx-xxx-xxx
⚠️  [EMAIL] Session ID: cs_test_xxx
⚠️  [EMAIL] Sending admin notification...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [EMAIL] Admin notification sent
```

**Expected admin@unbreak-one.com Inbox:**
- Subject: `Bestellbestätigung - Bestellung #...`
- Customer Name: `⚠️ ADMIN ALERT - No Customer Email`
- Product: `⚠️ ORDER WITHOUT CUSTOMER EMAIL`

### Test 4: EMAILS_ENABLED=false (Preview Mode)

**Scenario:** Test with `EMAILS_ENABLED=false`

**Expected Logs:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 [EMAIL PREVIEW] Email sending is DISABLED
📧 [EMAIL PREVIEW] Type:      order-confirmation
📧 [EMAIL PREVIEW] To:        test@example.com
📧 [EMAIL PREVIEW] BCC:       admin@unbreak-one.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  [EMAIL PREVIEW] To enable sending: Set EMAILS_ENABLED=true
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Expected Result:**
- ✅ No email sent to Resend
- ✅ Webhook still returns 200 OK
- ✅ Order still marked as paid
- ✅ Detailed logs for debugging

---

## 🚨 ACCEPTANCE CRITERIA

**Must Pass Before Merge to Master:**
- [ ] Test 1: Stripe test webhook passes
- [ ] Test 2: Real order test passes
- [ ] Test 3: Invalid email → admin notification works
- [ ] Vercel logs show correct email source
- [ ] Resend Dashboard shows 2 deliveries (TO + BCC)
- [ ] admin@unbreak-one.com receives BCC for all orders
- [ ] Customer receives email (TO)
- [ ] No webhook errors (200 OK)
- [ ] No Resend API errors

---

## 📊 EMAIL RESOLUTION PRIORITY

```
PRIORITY 1: session.customer_details?.email
  ↓ (if empty or invalid)
PRIORITY 2: session.customer_email
  ↓ (if empty or invalid)
PRIORITY 3: session.metadata?.customer_email (validated)
  ↓ (if empty or invalid)
FALLBACK: Send admin notification to admin@unbreak-one.com
```

**Validation Rules:**
- Email must be non-empty string
- Must contain `@`
- Must contain `.`
- Length must be > 5 characters

**Examples:**
- ✅ `dirk@ricks-kiel.de` → VALID
- ✅ `test@example.com` → VALID
- ❌ `guest` → INVALID (no @ or .)
- ❌ `null` → INVALID (empty)
- ❌ `""` → INVALID (empty)

---

## 🔧 VERCEL ENV SETUP (CRITICAL!)

**Local `.env.local`:**
```bash
EMAILS_ENABLED=true
RESEND_API_KEY=re_REDACTED
```

**Vercel Dashboard (Preview + Production):**
1. Go to: https://vercel.com/[team]/[project]/settings/environment-variables
2. Add: `EMAILS_ENABLED` = `true`
3. Environment: Preview + Production
4. Save
5. Redeploy

**⚠️ CRITICAL:** Without `EMAILS_ENABLED=true` in Vercel, emails will NOT be sent!

---

## 📧 RESEND DASHBOARD

**URL:** https://resend.com/emails

**What to Check:**
- Email status: Delivered ✅
- From: `UNBREAK ONE <orders@unbreak-one.com>`
- To: Customer email
- BCC: `admin@unbreak-one.com`
- Reply-To: `support@unbreak-one.com`
- Subject: German or English based on customer locale

**Expected Deliveries per Order:**
- 1x TO (customer)
- 1x BCC (admin)
- **Total: 2 deliveries**

---

## 🐛 TROUBLESHOOTING

### Issue: No email sent, logs show "EMAILS_ENABLED=false"
**Solution:** Set `EMAILS_ENABLED=true` in Vercel Dashboard

### Issue: Webhook returns 401 error
**Solution:** This was fixed in commit 47f2496 (removed HTTP fetch)
- Check: No fetch to `/api/email/order` in webhook code
- Should use: Direct import `sendOrderConfirmation`

### Issue: Resend shows only 1 delivery (no BCC)
**Solution:** Check Vercel logs for BCC line:
```
📧 [EMAIL] BCC: admin@unbreak-one.com
```
If missing, redeploy (code might not be updated)

### Issue: Admin notification for every order
**Solution:** Check real Stripe event data:
- Should have `customer_details.email` populated
- If missing, Stripe Checkout might not collect email
- Fix: Enable email collection in Stripe Checkout settings

### Issue: Email goes to "guest@example.com" or similar
**Solution:** Check priority resolution logs:
```
📧 [EMAIL SOURCE] session.customer_details?.email: xxx
📧 [EMAIL RESOLVED] Source: xxx
```
Should resolve from `customer_details.email` first

---

## ✅ MERGE TO MASTER (After Successful Test)

```bash
git checkout master
git merge staging --no-ff -m "EMAIL FIX: Email resolution + BCC + Admin notification"
git push origin master
git tag v0.9.3-email-fix
git push origin v0.9.3-email-fix
```

---

## 📝 COMMIT INFO

**Branch:** staging  
**Commit:** f934128  
**Message:** EMAIL FIX: Priority-based email resolution + BCC + Admin notification

**Files Changed:**
- `pages/api/webhooks/stripe.js` - Email resolution rewrite
- `lib/email/emailService.ts` - BCC support

**Next Steps:**
1. Wait for Vercel preview deployment (~2 min)
2. Run Test 1 (Stripe test webhook)
3. Run Test 2 (Real order)
4. Verify BCC delivery
5. Merge to master if all tests pass

---

**Testing Date:** 2026-01-15  
**Messe:** Day 2  
**Priority:** CRITICAL 🚨
