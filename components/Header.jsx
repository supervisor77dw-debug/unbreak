import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { navigateToConfigurator, getCurrentLanguage } from '../lib/configuratorLink';

export default function Header() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [currentLang, setCurrentLang] = useState('de');
  const [ctaHidden, setCtaHidden] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const headerInnerRef = useRef(null);
  const brandRef = useRef(null);
  const navRef = useRef(null);
  const controlsRef = useRef(null);
  const ctaRef = useRef(null);

  // Progressive Collapse: 3 Stufen (Normal → CTA hidden → Burger)
  useLayoutEffect(() => {
    const checkSpace = () => {
      if (!headerInnerRef.current || !brandRef.current || !navRef.current || !controlsRef.current) {
        return;
      }

      const available = headerInnerRef.current.clientWidth;
      const neededBrand = brandRef.current.scrollWidth;
      const neededNav = navRef.current.scrollWidth;
      const neededControls = controlsRef.current.scrollWidth;
      const gaps = 32; // 2x column-gap 16px

      // Stufe 1: Mit CTA
      let neededTotal = neededBrand + neededNav + neededControls + gaps;

      if (neededTotal > available && !ctaHidden) {
        // Stufe 2: CTA verstecken und neu messen
        setCtaHidden(true);
        return;
      }

      if (ctaHidden) {
        // Neu messen ohne CTA
        const neededCTA = ctaRef.current ? ctaRef.current.scrollWidth : 0;
        neededTotal = neededBrand + neededNav + (neededControls - neededCTA) + gaps;
      }

      // Stufe 3: Wenn es immer noch nicht passt → Burger aktivieren
      const shouldCollapse = neededTotal > available;

      if (shouldCollapse !== isCollapsed) {
        setIsCollapsed(shouldCollapse);
      }

      // Wenn genug Platz: CTA wieder anzeigen
      if (ctaHidden && !shouldCollapse) {
        const neededWithCTA = neededBrand + neededNav + neededControls + gaps;
        if (neededWithCTA <= available) {
          setCtaHidden(false);
        }
      }
    };

    // Initiale Messung nach kurzer Verzögerung (DOM muss gerendert sein)
    const timer = setTimeout(checkSpace, 50);

    // ResizeObserver für dynamische Anpassung
    const resizeObserver = new ResizeObserver(() => {
      checkSpace();
    });

    if (headerInnerRef.current) {
      resizeObserver.observe(headerInnerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [ctaHidden, isCollapsed]);

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
        src="/language-switch.js?v=2.0.4"
        strategy="afterInteractive"
      />

      <header className="site-header">
        <div className="header-inner" ref={headerInnerRef}>
          {/* Logo Links */}
          <div className="header-brand" ref={brandRef}>
            <a href="/index.html" className="logo-link">
              <img src="/images/logo.png" alt="UNBREAK ONE" className="nav-logo" />
            </a>
          </div>

          {/* Navigation Mittig */}
          <nav className={`header-nav ${isCollapsed ? 'collapsed' : ''}`} ref={navRef}>
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

          {/* CTA im Mobile-Menü */}
          <li className="mobile-only"><a href="/shop" className="btn btn-nav" data-i18n="nav.buyNow">Jetzt kaufen</a></li>

          </ul>
          </nav>

          {/* Controls Rechts: CTA + Language + Burger */}
          <div className="header-controls" ref={controlsRef}>
            {!ctaHidden && !isCollapsed && (
              <a href="/shop" className="btn btn-nav" data-i18n="nav.buyNow" ref={ctaRef}>Jetzt kaufen</a>
            )}
            {/* Language-Switch wird hier von language-switch.js injiziert */}
            <div 
              className={`burger-menu ${isMenuOpen ? 'active' : ''} ${isCollapsed ? 'visible' : ''}`}
              id="burgerMenu" 
              onClick={toggleMenu}
            >
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
