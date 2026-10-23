# Product Approval Workflow - Migration Guide

## ✅ Migration Created

**File:** `database/product-approval-workflow.sql`

## 🎯 What This Migration Does

### 1️⃣ Products Table Extensions
- **`status`**: `draft` | `pending_review` | `approved` | `rejected`
- **`created_by`**: User who created the product
- **`approved_by`**: Admin who approved/rejected
- **`approved_at`**: Approval timestamp

### 2️⃣ Storage Bucket
- **Bucket Name**: `product-images`
- Upload: Authenticated users only
- Public Access: Only for approved products
- Admin: Full access to all images

### 3️⃣ RLS Policies

#### Public
✅ Can view approved products only

#### Regular Users
✅ Can create products (draft/pending_review)
✅ Can view their own products
✅ Can edit their own products (if not approved)
✅ Can delete their own drafts

#### Admins
✅ Can view ALL products
✅ Can approve/reject products
✅ Can edit/delete any product
✅ Can create products directly as approved

### 4️⃣ Helper Functions
- `submit_product_for_review(product_id)` - User submits draft
- `approve_product(product_id)` - Admin approves
- `reject_product(product_id, reason)` - Admin rejects

### 5️⃣ Data Migration
All existing products automatically set to `approved` status

---

## 🚀 How to Execute

### Step 1: Run Migration in Supabase

1. Go to: [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Create new query
3. Copy content of `database/product-approval-workflow.sql`
4. Run query
5. Verify success messages

### Step 2: Create Test Users

In Supabase Dashboard → Authentication → Users:

**Regular User:**
- Email: `user@test.com`
- Password: `Test123!`

**Admin User:**
- Email: `admin@test.com`
- Password: `<ADMIN_SEED_PASSWORD>`

### Step 3: Set Admin Role

Run in SQL Editor:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@test.com';
```

---

## 🔍 Verification Queries

### Check products by status
```sql
SELECT status, COUNT(*) as count
FROM products
GROUP BY status;
```

### Check storage bucket
```sql
SELECT id, name, public
FROM storage.buckets
WHERE id = 'product-images';
```

### Check RLS policies
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;
```

---

## 🎮 Testing the Workflow

### As User (user@test.com)

1. Create product:
```sql
INSERT INTO products (name, sku, base_price_cents, created_by, status)
VALUES ('Test Product', 'TEST-001', 4990, auth.uid(), 'draft');
```

2. Submit for review:
```sql
SELECT submit_product_for_review('<product-id>');
```

### As Admin (admin@test.com)

3. View pending products:
```sql
SELECT id, name, status, created_by
FROM products
WHERE status = 'pending_review';
```

4. Approve product:
```sql
SELECT approve_product('<product-id>');
```

### As Public (Not logged in)

5. Verify product is visible:
```sql
SELECT id, name, status
FROM products
WHERE status = 'approved';
```

---

## ✅ Success Criteria

- [ ] Migration runs without errors
- [ ] Products table has new columns
- [ ] Storage bucket `product-images` exists
- [ ] RLS policies are active
- [ ] Existing products migrated to `approved`
- [ ] Test users created
- [ ] Admin role assigned
- [ ] Workflow tested end-to-end

---

## 🛑 Rollback (If Needed)

```sql
-- Remove new columns
ALTER TABLE products
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at;

-- Remove functions
DROP FUNCTION IF EXISTS submit_product_for_review;
DROP FUNCTION IF EXISTS approve_product;
DROP FUNCTION IF EXISTS reject_product;

-- Remove bucket
DELETE FROM storage.buckets WHERE id = 'product-images';
```
