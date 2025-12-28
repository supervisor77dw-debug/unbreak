# UNBREAK ONE - Quick Start Guide

## 🚀 Setup in 1 Minute

### Prerequisites
- **Node.js 20.x LTS** (required for Next.js 14 compatibility)
- npm 9.x or higher
- Git

### 1️⃣ Install Node 20 (if needed)

```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Verify
node --version  # Should show v20.x.x
```

### 2️⃣ Clone & Install

```bash
git clone <your-repo-url>
cd Unbreak_One

# Clean install
npm run reinstall

# Or standard install
npm install
```

### 3️⃣ Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

**Required variables** (get from Supabase/Stripe dashboards):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Optional** (recommended for production):
```env
NEXT_PUBLIC_SITE_URL=https://unbreak-one.com
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4️⃣ Database Setup

Run SQL scripts in **Supabase Dashboard → SQL Editor**:

1. `database/schema.sql` - Core tables
2. `database/auth-setup.sql` - Authentication
3. `database/catalog-setup.sql` - Products/Bundles
4. `database/seed-products.sql` - Sample products (optional)

Or use the Node script:
```bash
npm run seed
```

### 5️⃣ Run Development Server

```bash
npm run dev
```

Visit:
- http://localhost:3000 - Homepage
- http://localhost:3000/shop - Product listing
- http://localhost:3000/configurator - 3D Configurator

---

## 🏥 Health Check

Before deploying, run:

```bash
npm run healthcheck
```

This validates:
- ✅ Node version (20.x)
- ✅ File structure
- ✅ No hardcoded URLs
- ✅ Environment variables
- ✅ Dependencies

---

## 🛠️ Troubleshooting

### Dev server crashes on any request

**Likely cause:** Node 22 incompatibility or corrupted build cache

**Fix:**
```bash
# 1. Switch to Node 20
nvm use 20

# 2. Clean reinstall
npm run reinstall

# 3. Clear Next.js cache
npm run clean:next

# 4. Try again
npm run dev
```

### /shop returns 404

**Check:**
1. File exists: `pages/shop.js` ✓
2. No rewrite to `.html` in `next.config.js` or `vercel.json` ✓
3. Build succeeded: `npm run build` ✓

### Checkout redirects broken

**Fix:** Set `NEXT_PUBLIC_SITE_URL` in `.env.local`:
```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

Checkout URLs will use this instead of guessing from headers.

### Build fails with "env var missing"

**Old issue (fixed):** Module-level Supabase client creation

**Solution already applied:**
- `lib/supabase.js` now uses lazy initialization
- Build-safe: returns `null` if env vars missing
- No crashes during Next.js build phase

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run dev:clean` | Clean `.next` + start dev |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run healthcheck` | Validate repo health |
| `npm run seed` | Seed products into Supabase |
| `npm run clean:next` | Remove `.next` cache |
| `npm run clean:all` | Remove `.next` + `node_modules` |
| `npm run reinstall` | Full clean + reinstall |

---

## 🌐 Deployment (Vercel)

### 1. Connect Git Repository

In Vercel Dashboard:
1. Import Project
2. Connect to correct GitHub repo: `supervisor77dw-debug/unbreak`
3. Framework: **Next.js** (auto-detected)

### 2. Environment Variables

Add in Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL (set to https://unbreak-one.com)
STRIPE_WEBHOOK_SECRET
```

### 3. Build Settings

Should be auto-configured via `vercel.json`:

- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Node Version:** 20.x (set via `.nvmrc`)

### 4. Deploy

```bash
# Push to master triggers auto-deploy
git push origin master

# Or manual deploy
vercel --prod
```

---

## 🔐 Security Checklist

Before going live:

- [ ] All `STRIPE_SECRET_KEY` vars are server-side only (not `NEXT_PUBLIC_`)
- [ ] No hardcoded domains (use `NEXT_PUBLIC_SITE_URL`)
- [ ] Supabase RLS policies enabled
- [ ] Stripe webhook secret configured
- [ ] HTTPS enforced in production
- [ ] `.env.local` in `.gitignore` ✓

---

## 📚 Architecture

**Framework:** Next.js 14.0.4 (Pages Router)

**Routes:**
- `pages/shop.js` - Dynamic SSR (getServerSideProps)
- `pages/api/checkout/*` - Stripe Checkout API routes
- `public/*.html` - Static marketing pages

**Database:** Supabase (PostgreSQL + RLS)

**Payment:** Stripe Checkout Sessions

**Deployment:** Vercel (Edge Functions for API routes)

---

## 🐛 Known Issues

### 1. Localhost crashes (Node 22)

**Status:** Diagnosed, not fixed
**Workaround:** Use Node 20 LTS (`nvm use 20`)

### 2. Dropbox sync conflicts

**Status:** Potential cause of crashes
**Workaround:** Move project outside Dropbox or pause sync during dev

---

## 📞 Support

Run `npm run healthcheck` first - it auto-diagnoses most issues.

For repo-specific problems, check:
- `vercel.json` - Deployment config
- `next.config.js` - Next.js config
- `.nvmrc` - Node version lock
- `package.json` - Scripts & dependencies
