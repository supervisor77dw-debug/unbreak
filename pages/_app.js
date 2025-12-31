// Global CSS imports
import '../public/styles.css';
import '../public/animations.css';
import '../public/readability-optimization.css';
import '../public/i18n.css';
import '../public/premium.css';
import { SessionProvider } from 'next-auth/react';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
