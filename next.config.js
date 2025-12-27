/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Rewrite rules: Root → index.html, /shop → shop.html, etc.
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },

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
