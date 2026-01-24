import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { navigateToConfigurator, getCurrentLanguage } from '../lib/configuratorLink';

export default function Header() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [currentLang, setCurrentLang] = useState('de');

  // Close menu on route change
  useEffect(() => {
    const handleRouteChange = () => setIsMenuOpen(false);
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events]);

  // Listen to language changes and trigger i18n content update
  useEffect(() => {
    const handleLanguageChange = (e) => {
      setCurrentLang(e.detail.lang);
      
      // Trigger i18n content update (after state update)
      if (window.i18n) {
        setTimeout(() => {
          window.i18n.updateContent();
        }, 0);
      }
    };

    // Listen to both language change events
    window.addEventListener('languageChanged', handleLanguageChange);
    window.addEventListener('i18nLanguageChanged', handleLanguageChange);

    // Get initial language
    if (window.i18n) {
      setCurrentLang(window.i18n.getCurrentLanguage());
    }

    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange);
      window.removeEventListener('i18nLanguageChanged', handleLanguageChange);
    };
  }, []);

  // Trigger i18n update when component mounts or language changes
  useEffect(() => {
    if (scriptsLoaded && window.i18n) {
      window.i18n.updateContent();
    }
  }, [scriptsLoaded, currentLang]);

  // Navigate to configurator in same tab
  const handleConfiguratorClick = (e) => {
    e.preventDefault();
    
    // Get current language and return URL
    const currentLang = getCurrentLanguage();
    const returnUrl = `${window.location.origin}/shop`;
    
    // Navigate in same tab (no new window)
    navigateToConfigurator(currentLang, returnUrl);
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
        src="/language-switch.js?v=2.0.5"
        strategy="afterInteractive"
      />

      {/* Deterministic Header Structure - CSS Grid Layout */}
      <header className="site-header">
        <nav className="header-nav">
          {/* GRID AREA: logo (left) */}
          <div className="header-logo">
            <a href="/index.html" className="logo-link">
              <img src="/images/logo.png" alt="UNBREAK ONE" className="nav-logo" />
            </a>
          </div>

          {/* GRID AREA: controls (right, fixed position) */}
          <div className="header-controls">
            {/* Language Switch Placeholder - filled by language-switch.js */}
            <div className="header-lang-slot" id="headerLangSlot"></div>
            
            {/* Burger Menu - ALWAYS in this exact DOM position */}
            <button 
              className={`header-burger ${isMenuOpen ? 'active' : ''}`}
              id="burgerMenu" 
              onClick={toggleMenu}
              aria-label="Menu"
              aria-expanded={isMenuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>

          {/* GRID AREA: nav (desktop: inline, mobile: slides in) */}
          <ul className={`nav-links ${isMenuOpen ? 'active' : ''}`} id="navLinks">
            <li><a href="/index.html" data-page="index" data-i18n="nav.home" className={activePage === 'index' ? 'active' : ''}>Start</a></li>
            <li><a href="/produkt.html" data-page="produkt" data-i18n="nav.product" className={activePage === 'produkt' ? 'active' : ''}>Produkt</a></li>
            <li><a href="/einsatzbereiche.html" data-page="einsatzbereiche" data-i18n="nav.useCases" className={activePage === 'einsatzbereiche' ? 'active' : ''}>Einsatzbereiche</a></li>
            <li><a href="/gastro-edition.html" data-page="gastro-edition" data-i18n="nav.gastroEdition" className={activePage === 'gastro-edition' ? 'active' : ''}>Gastro Edition</a></li>
            <li><a href="/technik.html" data-page="technik" data-i18n="nav.tech" className={activePage === 'technik' ? 'active' : ''}>Technik</a></li>
            <li><a href="#" onClick={handleConfiguratorClick} data-page="configurator" data-i18n="nav.configurator" className={activePage === 'configurator' ? 'active' : ''}>Konfigurator</a></li>
            <li><a href="/shop" data-page="shop" data-i18n="nav.shop" className={activePage === 'shop' ? 'active' : ''}>Shop</a></li>
            <li><a href="/kontakt.html" data-page="kontakt" data-i18n="nav.contact" className={activePage === 'kontakt' ? 'active' : ''}>Kontakt</a></li>

            {/* Mobile Only Legal Links */}
            <li className="mobile-only"><a href="/impressum.html" data-page="impressum" data-i18n="nav.impressum">Impressum</a></li>
            <li className="mobile-only"><a href="/datenschutz.html" data-page="datenschutz" data-i18n="nav.privacy">Datenschutz</a></li>
            <li className="mobile-only"><a href="/agb.html" data-page="agb" data-i18n="nav.terms">AGB</a></li>

            <li><a href="/shop" className="btn btn-nav" data-i18n="nav.buyNow">Jetzt kaufen</a></li>
          </ul>
        </nav>
      </header>
    </>
  );
}
