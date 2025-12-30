/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
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
      {
        source: '/configurator',
        destination: '/configurator.html',
      },
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
};

module.exports = nextConfig;
