import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="de">
      <Head>
        {/* Global CSS - Same as index.html */}
        <link rel="stylesheet" href="/styles.css?v=2.0.3" />
        <link rel="stylesheet" href="/animations.css?v=2.0.3" />
        <link rel="stylesheet" href="/readability-optimization.css?v=2.0.3" />
        <link rel="stylesheet" href="/i18n.css?v=2.0.3" />
        <link rel="stylesheet" href="/premium.css?v=2.0.3" />
        
        {/* Global Scripts - Same as index.html */}
        <script src="/version.js?v=2.0.3"></script>
        <script src="/i18n.js?v=2.0.0"></script>
        <script src="/language-switch.js?v=2.0.0" defer></script>
        <script src="/animations.js?v=2.0.0" defer></script>
        <script src="/script.js?v=2.0.0"></script>
        
        {/* External Libraries */}
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
        <script src="/motion.js?v=2.0.1" defer></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
