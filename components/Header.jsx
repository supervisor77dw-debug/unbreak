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

  // Close menu on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen]);

  // Toggle body class for menu state
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  }, [isMenuOpen]);

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
        src="/language-switch.js?v=2.0.4"
        strategy="afterInteractive"
      />

      <header className="site-header">
        <div className="header-inner">
          {/* Brand (Logo) */}
          <a className="brand" href="/index.html">
            <img src="/images/logo.png" alt="UNBREAK ONE" className="nav-logo" />
          </a>

          {/* Navigation (Desktop/Mobile toggle) */}
          <nav id="primary-nav" className="header-nav" aria-label="Primary">
            <ul className={`nav-links header-nav-list ${isMenuOpen ? 'active' : ''}`} id="navLinks">
          <li><a href="/index.html" data-page="index" data-i18n="nav.home" className={activePage === 'index' ? 'active' : ''}>Start</a></li>
          <li><a href="/produkt.html" data-page="produkt" data-i18n="nav.product" className={activePage === 'produkt' ? 'active' : ''}>Produkt</a></li>
          <li><a href="/einsatzbereiche.html" data-page="einsatzbereiche" data-i18n="nav.useCases" className={activePage === 'einsatzbereiche' ? 'active' : ''}>Einsatzbereiche</a></li>
          <li><a href="/gastro-edition.html" data-page="gastro-edition" data-i18n="nav.gastroEdition" className={activePage === 'gastro-edition' ? 'active' : ''}>Gastro Edition</a></li>
          <li><a href="/technik.html" data-page="technik" data-i18n="nav.tech" className={activePage === 'technik' ? 'active' : ''}>Technik</a></li>
          <li><a href="#" onClick={handleConfiguratorClick} data-page="configurator" data-i18n="nav.configurator" className={activePage === 'configurator' ? 'active' : ''}>Konfigurator</a></li>
          <li><a href="/shop" data-page="shop" data-i18n="nav.shop" className={activePage === 'shop' ? 'active' : ''}>Shop</a></li>
          <li><a href="/kontakt.html" data-page="kontakt" data-i18n="nav.contact" className={activePage === 'kontakt' ? 'active' : ''}>Kontakt</a></li>
          </ul>
          </nav>

          {/* Controls (Cart + Language + Burger) */}
          <div className="header-controls">
            {/* Mount-Point für Cart-Badge (wird von shop.js injiziert, >= 1400px) */}
            <div id="header-cart-mount"></div>
            {/* Mount-Point für Language-Switch (wird von language-switch.js injiziert) */}
            <div id="language-switch-mount"></div>
            {/* Burger (Mobile only) */}
            <button 
              className={`burger ${isMenuOpen ? 'active' : ''}`}
              id="burgerMenu" 
              onClick={toggleMenu}
              aria-controls="primary-nav"
              aria-expanded={isMenuOpen}
              aria-label="Menu"
              type="button"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
        
        {/* Second Header Row - Cart Badge (<1400px only) */}
        <div className="header-cart-row">
          <div id="header-cart-mobile-mount"></div>
        </div>

        {/* MOBILE NAV PANEL (Offcanvas) */}
        <div className={`mobile-nav-panel ${isMenuOpen ? 'open' : ''}`}>
          <ul className="mobile-nav-list">
            <li><a href="/index.html" data-page="index" data-i18n="nav.home" onClick={toggleMenu}>Start</a></li>
            <li><a href="/produkt.html" data-page="produkt" data-i18n="nav.product" onClick={toggleMenu}>Produkt</a></li>
            <li><a href="/einsatzbereiche.html" data-page="einsatzbereiche" data-i18n="nav.useCases" onClick={toggleMenu}>Einsatzbereiche</a></li>
            <li><a href="/gastro-edition.html" data-page="gastro-edition" data-i18n="nav.gastroEdition" onClick={toggleMenu}>Gastro Edition</a></li>
            <li><a href="/technik.html" data-page="technik" data-i18n="nav.tech" onClick={toggleMenu}>Technik</a></li>
            <li><a href="#" onClick={(e) => { handleConfiguratorClick(e); toggleMenu(); }} data-page="configurator" data-i18n="nav.configurator">Konfigurator</a></li>
            <li><a href="/shop" data-page="shop" data-i18n="nav.shop" onClick={toggleMenu}>Shop</a></li>
            <li><a href="/kontakt.html" data-page="kontakt" data-i18n="nav.contact" onClick={toggleMenu}>Kontakt</a></li>
            <li className="divider"></li>
            <li><a href="/impressum.html" data-page="impressum" data-i18n="nav.impressum" onClick={toggleMenu}>Impressum</a></li>
            <li><a href="/datenschutz.html" data-page="datenschutz" data-i18n="nav.privacy" onClick={toggleMenu}>Datenschutz</a></li>
            <li><a href="/agb.html" data-page="agb" data-i18n="nav.terms" onClick={toggleMenu}>AGB</a></li>
            <li className="divider"></li>
            <li><a href="/shop" className="btn btn-primary" data-i18n="nav.buyNow" onClick={toggleMenu}>Jetzt kaufen</a></li>
          </ul>
        </div>

        {/* MOBILE NAV OVERLAY (Click-to-close) */}
        <div className={`mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`} onClick={toggleMenu}></div>
      </header>
    </>
  );
}
