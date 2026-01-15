// Global CSS imports
import '../public/styles.css';
import '../public/animations.css';
import '../public/readability-optimization.css';
import '../public/i18n.css';
import '../public/premium.css';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  // Inject ENV variables for client-side access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.ENV = {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://unbreak-one.com',
        NEXT_PUBLIC_CONFIGURATOR_DOMAIN: process.env.NEXT_PUBLIC_CONFIGURATOR_DOMAIN || 'https://unbreak-3-d-konfigurator.vercel.app',
      };
    }
  }, []);
  
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
