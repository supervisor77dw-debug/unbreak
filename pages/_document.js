import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="de">
      <Head>
        {/* External Libraries */}
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
        
        {/* Canonical URL - set dynamically by middleware */}
        {/* Per-page canonical should be set in page component Head */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
