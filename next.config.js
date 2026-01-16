/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled to prevent hydration issues with i18n
  
  // Allow images from Supabase Storage
  images: {
    domains: [
      'qnzsdytdghfukrqpscsg.supabase.co',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  // Rewrite rules: Root → index.html, /shop → pages/shop.js (dynamic), etc.
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },
      // Note: /shop uses pages/shop.js (dynamic SSR), no rewrite needed
      {
        source: '/produkt',
        destination: '/produkt.html',
      },
      {
        source: '/einsatzbereiche',
        destination: '/einsatzbereiche.html',
      },
      {
        source: '/gastro-edition',
        destination: '/gastro-edition.html',
      },
      {
        source: '/technik',
        destination: '/technik.html',
      },
      {
        source: '/kontakt',
        destination: '/kontakt.html',
      },
      // NOTE: /configurator is now handled by redirect below (external URL)
      {
        source: '/impressum',
        destination: '/impressum.html',
      },
      {
        source: '/datenschutz',
        destination: '/datenschutz.html',
      },
      {
        source: '/agb',
        destination: '/agb.html',
      },
    ];
  },
  
  // Redirect old /configurator route to external configurator
  async redirects() {
    const CONFIGURATOR_URL = process.env.NEXT_PUBLIC_CONFIGURATOR_DOMAIN || 'https://unbreak-3-d-konfigurator.vercel.app';
    const SHOP_URL = process.env.NEXT_PUBLIC_SITE_URL 
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/shop`
      : 'https://unbreak-one.com/shop';
    
    return [
      {
        source: '/configurator',
        destination: `${CONFIGURATOR_URL}/?lang=de&return=${encodeURIComponent(SHOP_URL)}`,
        permanent: false, // 307 temporary redirect
      },
      {
        source: '/configurator.html',
        destination: `${CONFIGURATOR_URL}/?lang=de&return=${encodeURIComponent(SHOP_URL)}`,
        permanent: false, // 307 temporary redirect
      },
      // NOTE: /admin/products should use pages/admin/products/index.js
      // Old redirect from products.js moved here to avoid route conflict
      {
        source: '/admin/products-legacy',
        destination: '/backend/products?filter=pending',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
