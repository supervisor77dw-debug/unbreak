# UNBREAK ONE - Admin System (OMS/CRM)

## 🎯 Overview

Internal Order Management System & Customer Relationship Management for UNBREAK ONE.

**Features:**
- ✅ Role-based access control (ADMIN, STAFF, SUPPORT)
- ✅ Order management with Stripe integration
- ✅ Customer database
- ✅ Ticket system for support/complaints/returns
- ✅ Refund processing
- ✅ Event logging & audit trails
- ✅ Secure authentication (NextAuth + bcrypt)

---

## 📦 Tech Stack

- **ORM:** Prisma 7.2.0
- **Database:** PostgreSQL (Supabase)
- **Auth:** NextAuth.js
- **Password:** bcryptjs
- **Framework:** Next.js 14 Pages Router

---

## 🔧 Setup

### 1. Environment Variables

Add to `.env.local` (local) and Vercel (production):

```bash
# Database (required)
DATABASE_URL="postgresql://user:password@host:5432/database"

# Auth (required)
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000" # Production: https://unbreak-one.vercel.app

# Initial Admin Seed (optional, only for first setup)
ADMIN_SEED_EMAIL="admin@unbreak-one.com"
ADMIN_SEED_PASSWORD="change-me-immediately"

# Existing variables (keep)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RESEND_FROM="UNBREAK ONE <noreply@yourdomain.com>"
SHOP_OWNER_EMAIL=shop@unbreak-one.com
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 2. Database Migration

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Apply to production
npm run prisma:deploy
```

**Note:** Migrations will create these tables:
- `admin_users` - Admin/Staff/Support users
- `admin_customers` - Customer records
- `admin_orders` - Orders with payment & fulfillment status
- `admin_order_items` - Order line items
- `admin_order_events` - Event log (webhooks, emails, changes)
- `admin_tickets` - Support tickets
- `admin_ticket_messages` - Ticket conversation
- `admin_refunds` - Refund requests

### 3. Seed Initial Admin

```bash
npm run prisma:seed
```

This creates the first ADMIN user with credentials from ENV.

**⚠️ IMPORTANT:** Change the password immediately after first login!

### 4. Deploy to Vercel

```bash
git add .
git commit -m "Add admin system (OMS/CRM)"
git push
```

Then in Vercel Dashboard:
1. Add all ENV variables
2. Redeploy
3. Run migration: `npx prisma migrate deploy` (via Vercel CLI or local connected to prod DB)

---

## 🔒 RBAC Matrix

### Role Permissions

| Feature | ADMIN | STAFF | SUPPORT |
|---------|-------|-------|---------|
| Dashboard | ✅ | ✅ | ✅ |
| View Orders | ✅ | ✅ | ✅ |
| Edit Orders | ✅ | ✅ | ❌ |
| Change Fulfillment | ✅ | ✅ | ❌ |
| Process Refunds | ✅ | ✅ | ❌ |
| View Customers | ✅ | ✅ | ✅ |
| View Tickets | ✅ | ✅ | ✅ |
| Create/Reply Tickets | ✅ | ✅ | ✅ |
| User Management | ✅ | ❌ | ❌ |
| Product Management | ✅ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ |

### Enforcement

- **Client-side:** UI elements hidden based on `session.user.role`
- **Server-side:** API routes protected with `requireRole()` middleware
- **Database:** Row-level security (RLS) planned for sensitive operations

---

## 🚀 Usage

### Access Admin Panel

1. Navigate to `https://unbreak-one.vercel.app/admin`
2. Login with admin credentials
3. Dashboard shows KPIs: orders today, open tickets, revenue, pending orders

### Routes

- `/admin` - Dashboard
- `/admin/login` - Login page
- `/admin/orders` - Order list (with filters)
- `/admin/orders/[id]` - Order detail (full info + actions)
- `/admin/customers` - Customer list
- `/admin/customers/[id]` - Customer detail (orders + tickets)
- `/admin/tickets` - Ticket list
- `/admin/tickets/[id]` - Ticket detail (conversation)
- `/admin/users` - User management (ADMIN only)
- `/admin/products` - Product management (ADMIN only, placeholder)

---

## 📊 Data Flow

### Order Creation (Customer → Admin)

```
1. Customer completes Stripe checkout
   ↓
2. Stripe webhook: /api/webhooks/stripe
   ↓
3. Order synced to Prisma DB:
   - Create Customer (if new)
   - Create Order (statusPayment: PENDING)
   - Create OrderItems
   - Create OrderEvent (type: STRIPE_WEBHOOK)
   ↓
4. Payment confirmed → Order.statusPayment = PAID
   ↓
5. Email sent via Resend
   ↓
6. OrderEvent logged (type: RESEND_SEND)
   ↓
7. Order appears in /admin/orders
```

### Ticket Creation

```
1. Customer contacts support (future: web form)
   ↓
2. Ticket created (linked to Customer + Order)
   ↓
3. Staff/Support replies in /admin/tickets/[id]
   ↓
4. TicketMessage created
   ↓
5. Status changed (OPEN → IN_PROGRESS → RESOLVED → CLOSED)
```

### Refund Processing

```
1. Staff creates Refund in Order detail
   ↓
2. Refund.status = REQUESTED
   ↓
3. Admin approves → call Stripe API
   ↓
4. Stripe refund created
   ↓
5. Refund.status = SUCCEEDED
   ↓
6. Order.statusPayment = REFUNDED (or PARTIALLY_REFUNDED)
```

---

## 🔄 Stripe Webhook Integration

The existing webhook handler needs to sync orders to Prisma.

### Current State
- Webhook: `/api/webhooks/stripe.js`
- Updates: `simple_orders` table (Supabase direct)

### Migration Strategy

**Option A (Recommended):** Dual-write during transition
1. Keep existing `simple_orders` updates (backward compat)
2. Add Prisma writes in parallel
3. Verify data consistency
4. Eventually deprecate `simple_orders`

**Option B:** Full migration
1. Migrate existing `simple_orders` → Prisma tables
2. Update webhook to use Prisma only
3. Update all order-related APIs

### Implementation (Next Step)

Modify `/api/webhooks/stripe.js`:

```javascript
// After successful Stripe payment
const session = event.data.object;

// 1. Upsert Customer
const customer = await prisma.customer.upsert({
  where: { email: session.customer_details.email },
  update: { 
    name: session.customer_details.name,
    lastOrderAt: new Date()
  },
  create: {
    email: session.customer_details.email,
    name: session.customer_details.name,
    lastOrderAt: new Date()
  }
});

// 2. Upsert Order
const order = await prisma.order.upsert({
  where: { stripeCheckoutSessionId: session.id },
  update: {
    statusPayment: 'PAID',
    stripePaymentIntentId: session.payment_intent,
    paidAt: new Date()
  },
  create: {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
    statusPayment: 'PAID',
    statusFulfillment: 'NEW',
    currency: session.currency.toUpperCase(),
    amountTotal: session.amount_total,
    amountShipping: session.total_details?.amount_shipping || 0,
    amountTax: session.total_details?.amount_tax || 0,
    email: session.customer_details.email,
    shippingName: session.shipping_details?.name,
    shippingAddress: session.shipping_details?.address,
    customerId: customer.id,
    paidAt: new Date()
  }
});

// 3. Create OrderItems
for (const item of session.line_items.data) {
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      name: item.description,
      qty: item.quantity,
      unitPrice: item.price.unit_amount,
      totalPrice: item.amount_total
    }
  });
}

// 4. Log event
await prisma.orderEvent.create({
  data: {
    orderId: order.id,
    type: 'STRIPE_WEBHOOK',
    source: 'stripe',
    payload: { event: event.type, session_id: session.id }
  }
});
```

---

## 🧪 Testing

### Local Development

```bash
# Start dev server
npm run dev

# Access admin
http://localhost:3000/admin

# Login with seeded admin
Email: admin@unbreak-one.com
Password: admin123 (or your ADMIN_SEED_PASSWORD)
```

### Test Data

Create test orders:
1. Go to shop page
2. Complete Stripe test checkout
3. Order appears in `/admin/orders`

### Prisma Studio (DB GUI)

```bash
npm run prisma:studio
```

Opens: `http://localhost:5555`

---

## 🛡️ Security

### Authentication
- ✅ Passwords hashed with bcrypt (salt rounds: 10)
- ✅ JWT sessions (8 hour expiry)
- ✅ Secret stored in ENV (`NEXTAUTH_SECRET`)

### Authorization
- ✅ Server-side role checks on all API routes
- ✅ Middleware blocks unauthorized access
- ✅ 401 for unauthenticated, 403 for forbidden

### Best Practices
- ❌ No client-side secrets
- ❌ No admin routes accessible without auth
- ❌ No sensitive data in logs (passwords, tokens)
- ✅ Audit trail via OrderEvents
- ✅ Idempotent webhook processing

---

## 📝 API Endpoints

### Auth
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Get session

### Admin
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/orders` - List orders (filters, pagination)
- `GET /api/admin/orders/[id]` - Order detail
- `PUT /api/admin/orders/[id]` - Update order
- `POST /api/admin/orders/[id]/resend-email` - Resend confirmation
- `GET /api/admin/customers` - List customers
- `GET /api/admin/tickets` - List tickets
- `POST /api/admin/tickets` - Create ticket
- `PUT /api/admin/tickets/[id]` - Update ticket
- `POST /api/admin/tickets/[id]/messages` - Add message
- `GET /api/admin/users` - List users (ADMIN only)
- `POST /api/admin/users` - Create user (ADMIN only)
- `PUT /api/admin/users/[id]` - Update user (ADMIN only)

All admin routes require authentication. Role-specific routes enforce `requireRole()`.

---

## 🔧 Troubleshooting

### Cannot login
- Check `DATABASE_URL` is correct
- Run `npm run prisma:seed` to create admin
- Verify `NEXTAUTH_SECRET` is set
- Check browser console for errors

### Prisma errors
- Run `npm run prisma:generate` after schema changes
- Run `npm run prisma:migrate` to apply migrations
- Check DATABASE_URL format: `postgresql://user:pass@host:5432/db`

### Orders not syncing
- Check Stripe webhook is firing
- Verify `STRIPE_WEBHOOK_SECRET` matches
- Check Vercel logs for webhook errors
- Ensure Prisma client is generated

### Permission denied
- Check user role in `/api/admin/users`
- Verify `requireRole()` allows your role
- Check session in browser devtools

---

## 🚧 Next Steps (Future Enhancements)

### Phase 2
- [ ] Order detail page (full implementation)
- [ ] Customer detail page
- [ ] Ticket conversation UI
- [ ] Refund processing flow
- [ ] Email resend from admin

### Phase 3
- [ ] Product management UI
- [ ] Bulk actions (export orders, bulk status update)
- [ ] Advanced filters & search
- [ ] Analytics dashboard (charts)

### Phase 4
- [ ] Customer-facing ticket portal
- [ ] Email notifications for ticket updates
- [ ] Automated refund workflows
- [ ] Inventory management

---

## 📚 Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://next-auth.js.org)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Vercel Deployment](https://vercel.com/docs)

---

## 🤝 Support

For admin system issues:
1. Check Vercel logs
2. Check Prisma Studio for data
3. Review `OrderEvents` table for webhook logs
4. Contact dev team

---

**Built with ❤️ for UNBREAK ONE**
