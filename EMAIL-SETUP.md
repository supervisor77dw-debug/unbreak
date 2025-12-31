# Email Configuration - Resend Integration

## Required Environment Variables

Add these to your Vercel project environment variables (or `.env.local` for local development):

### 1. RESEND_API_KEY (Required)
Your Resend API key for sending emails.

- **Get your API key:** https://resend.com/api-keys
- **Format:** `re_xxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Example:** `re_123abc456def789ghi012jkl345mno678`

```bash
RESEND_API_KEY=re_your_actual_api_key_here
```

### 2. RESEND_FROM (Required)
The "From" email address for all order confirmation emails.

- **Must be a verified domain in Resend**
- **Format:** `Name <email@domain.com>` or just `email@domain.com`
- **Example:** `UNBREAK ONE <noreply@unbreak-one.com>`

```bash
RESEND_FROM=UNBREAK ONE <noreply@yourdomain.com>
```

### 3. SHOP_OWNER_EMAIL (Optional)
If set, the shop owner will receive a copy of every order confirmation.

- **Format:** Standard email address
- **Example:** `shop@unbreak-one.com`

```bash
SHOP_OWNER_EMAIL=your-shop-email@yourdomain.com
```

---

## Vercel Setup

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: `unbreak-one`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Name:** `RESEND_API_KEY`
   - **Value:** Your actual API key
   - **Environment:** Production, Preview, Development (select all)
5. Repeat for `RESEND_FROM` and `SHOP_OWNER_EMAIL`
6. Redeploy your project for changes to take effect

---

## Resend Setup

### Step 1: Create Account
1. Sign up at https://resend.com
2. Verify your email

### Step 2: Add Domain
1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `unbreak-one.com`)
4. Add the DNS records shown to your domain provider:
   - **TXT record** for verification
   - **MX records** for email delivery
   - **DKIM records** for authentication
5. Wait for verification (usually takes a few minutes to 24 hours)

### Step 3: Create API Key
1. Go to **API Keys** in Resend dashboard
2. Click **Create API Key**
3. Name it (e.g., "UNBREAK ONE Production")
4. Copy the key (starts with `re_`)
5. Add to Vercel environment variables

### Step 4: Test Email
Once deployed, test with:
```bash
curl -X POST https://unbreak-one.vercel.app/api/email/test
```

---

## How It Works

### Email Flow
1. Customer completes Stripe checkout
2. Stripe webhook fires: `/api/webhooks/stripe`
3. Order status updated to `paid`
4. Email API called: `/api/email/order`
5. Two emails sent:
   - **Customer:** Order confirmation (DE/EN based on locale)
   - **Shop Owner:** New order notification (if configured)

### Idempotency
- Emails are tracked in memory per order ID + customer email
- Duplicate webhook events won't send duplicate emails
- Safe for Stripe webhook retries

### Language Detection
Automatic language selection based on:
1. Stripe session locale (`session.locale`)
2. Shipping country (EN for GB, US, CA, AU, NZ)
3. Default: German (DE)

### Error Handling
- Missing ENV variables return 500 error
- Email failures are logged but don't block webhook
- Idempotent: Won't send duplicates even if webhook retries

---

## Email Templates

### Customer Confirmation (Bilingual)
- **German:** Bestellbestätigung with order details
- **English:** Order Confirmation with order details
- Includes:
  - Order number
  - Itemized product list with quantities and prices
  - Total amount
  - Shipping address (if available)
  - Next steps (shipping timeline)
  - Support contact info

### Shop Owner Notification
- **Language:** Always German
- Includes:
  - Customer name and email
  - Full order details
  - Shipping address
  - Direct order ID for admin lookup

---

## API Endpoints

### POST /api/email/order
Send order confirmation email.

**Request Body:**
```json
{
  "orderId": "uuid",
  "orderNumber": "ABC12345",
  "customerEmail": "customer@example.com",
  "customerName": "Max Mustermann",
  "items": [
    {
      "name": "LED Strip White",
      "quantity": 2,
      "price_cents": 4990
    }
  ],
  "totalAmount": 9980,
  "language": "de",
  "shippingAddress": {
    "name": "Max Mustermann",
    "line1": "Musterstraße 123",
    "line2": "",
    "postal_code": "12345",
    "city": "Berlin",
    "country": "DE"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "emailId": "re_abc123...",
  "message": "Order confirmation email sent successfully"
}
```

**Response (Idempotent):**
```json
{
  "success": true,
  "message": "Email already sent (idempotent)",
  "skipped": true
}
```

---

## Testing

### Local Development
1. Create `.env.local`:
```bash
RESEND_API_KEY=re_your_test_api_key
RESEND_FROM=Test <test@yourdomain.com>
SHOP_OWNER_EMAIL=your-email@example.com
```

2. Start dev server:
```bash
npm run dev
```

3. Test with curl:
```bash
curl -X POST http://localhost:3000/api/email/order \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-123",
    "customerEmail": "test@example.com",
    "items": [{"name": "Test Product", "quantity": 1, "price_cents": 1990}],
    "totalAmount": 1990,
    "language": "de"
  }'
```

### Production Testing
Use the Stripe test mode webhook to trigger real flow:
1. Complete a test checkout
2. Check Vercel logs for email confirmation
3. Verify email received at customer address

---

## Troubleshooting

### Email Not Sending
1. **Check ENV variables** in Vercel dashboard
2. **Verify domain** in Resend dashboard
3. **Check API key** is valid and not expired
4. **Review Vercel logs** for error messages

### Email Goes to Spam
1. **Add SPF record** to DNS (provided by Resend)
2. **Add DKIM records** to DNS (provided by Resend)
3. **Use verified domain** (not @gmail.com)
4. **Warm up sending** gradually (start with low volume)

### Duplicate Emails
- Should not happen due to idempotency check
- If it does, check webhook logs in database
- Verify single webhook event per order

### Wrong Language
- Check Stripe session locale setting
- Check shipping country mapping
- Manually test with `language: "en"` parameter

---

## Monitoring

### Check Sent Emails
1. Go to Resend dashboard → **Emails**
2. View all sent emails with delivery status
3. Check for bounces or spam reports

### Check Webhook Logs
Query the `webhook_logs` table in Supabase:
```sql
SELECT * FROM webhook_logs 
WHERE event_type = 'checkout.session.completed'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Email Logs
Review Vercel function logs for email-related messages:
- `📧 [EMAIL]` prefix for email operations
- `✅` for success
- `❌` for errors

---

## Security

### API Key Protection
- Never commit API keys to Git
- Use Vercel environment variables only
- Rotate keys if exposed

### Email Endpoint
- Internal use only (called from webhook)
- No public authentication needed (called server-to-server)
- Validate all input parameters

### Rate Limiting
- Resend has rate limits based on plan
- Free plan: 100 emails/day
- Pro plan: Higher limits
- Idempotency prevents duplicate sends

---

## Next Steps

1. **Set up Resend account** and verify domain
2. **Add environment variables** to Vercel
3. **Test with real Stripe checkout** in test mode
4. **Monitor first few orders** for successful delivery
5. **Consider upgrading Resend plan** for higher volume

---

## Support

- **Resend Docs:** https://resend.com/docs
- **Resend Support:** support@resend.com
- **Vercel Logs:** https://vercel.com/unbreak-one/logs
