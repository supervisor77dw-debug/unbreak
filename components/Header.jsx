import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';

export default function Header() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  // Close menu on route change
  useEffect(() => {
    const handleRouteChange = () => setIsMenuOpen(false);
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events]);

  // NEW: Handle configurator link click with redirect to external configurator
  const handleConfiguratorClick = (e) => {
    e.preventDefault();
    
    // Get current language from i18n or default to 'de'
    const currentLang = (typeof window !== 'undefined' && window.i18n?.getCurrentLanguage) 
      ? window.i18n.getCurrentLanguage() 
      : 'de';
    
    // Return URL after configuration
    const returnUrl = encodeURIComponent(`${window.location.origin}/shop`);
    
    // Redirect to external configurator
    // PRODUCTION: Replace with actual domain
    const configDomain = process.env.NEXT_PUBLIC_CONFIGURATOR_DOMAIN || 'https://unbreak-3-d-konfigurator.vercel.app';
    const redirectUrl = `${configDomain}/?lang=${currentLang}&return=${returnUrl}`;
    
    console.info('[MENU] Redirecting to configurator:', redirectUrl);
    window.location.href = redirectUrl;
  };

  // Determine active page
  const getActivePage = () => {
    const path = router.pathname;
    if (path === '/') return 'index';
    if (path === '/shop') return 'shop';
    return path.replace('/', '').replace('.html', '');
  };

  const activePage = getActivePage();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      {/* i18n Scripts - Load on all pages */}
      <Script
        src="/i18n.js?v=2.0.4"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(true)}
      />
      <Script
        src="/language-switch.js?v=2.0.4"
        strategy="afterInteractive"
      />

      <header>
      <nav>
        <div className="logo">
          <a href="/index.html" className="logo-link">
            <img src="/images/logo.png" alt="UNBREAK ONE" className="nav-logo" />
          </a>
        </div>

        {/* Mobile Burger Menu */}
        <div 
          className={`burger-menu ${isMenuOpen ? 'active' : ''}`}
          id="burgerMenu" 
          onClick={toggleMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* Navigation Links */}
        <ul className={`nav-links ${isMenuOpen ? 'active' : ''}`} id="navLinks">
          <li><a href="/index.html" data-page="index" className={activePage === 'index' ? 'active' : ''}>Start</a></li>
          <li><a href="/produkt.html" data-page="produkt" className={activePage === 'produkt' ? 'active' : ''}>Produkt</a></li>
          <li><a href="/einsatzbereiche.html" data-page="einsatzbereiche" className={activePage === 'einsatzbereiche' ? 'active' : ''}>Einsatzbereiche</a></li>
          <li><a href="/gastro-edition.html" data-page="gastro-edition" className={activePage === 'gastro-edition' ? 'active' : ''}>Gastro Edition</a></li>
          <li><a href="/technik.html" data-page="technik" className={activePage === 'technik' ? 'active' : ''}>Technik</a></li>
          <li><a href="#" onClick={handleConfiguratorClick} data-page="configurator" className={activePage === 'configurator' ? 'active' : ''}>Konfigurator</a></li>
          <li><a href="/shop" data-page="shop" className={activePage === 'shop' ? 'active' : ''}>Shop</a></li>
          <li><a href="/kontakt.html" data-page="kontakt" className={activePage === 'kontakt' ? 'active' : ''}>Kontakt</a></li>

          {/* Mobile Only Legal Links */}
          <li className="mobile-only"><a href="/impressum.html" data-page="impressum">Impressum</a></li>
          <li className="mobile-only"><a href="/datenschutz.html" data-page="datenschutz">Datenschutz</a></li>
          <li className="mobile-only"><a href="/agb.html" data-page="agb">AGB</a></li>

          <li><a href="/shop" className="btn btn-nav">Jetzt kaufen</a></li>
          
          {/* Language Switch will be injected here by language-switch.js */}
        </ul>
      </nav>
    </header>
    </>
  );
}
