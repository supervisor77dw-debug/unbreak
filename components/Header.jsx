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

  // NEW: Handle configurator link with FAIL-SAFE health check
  const handleConfiguratorClick = async (e) => {
    e.preventDefault();
    
    // Get current language from i18n or default to 'de'
    const currentLang = (typeof window !== 'undefined' && window.i18n?.getCurrentLanguage) 
      ? window.i18n.getCurrentLanguage() 
      : 'de';
    
    // Return URL after configuration
    const returnUrl = encodeURIComponent(`${window.location.origin}/shop`);
    
    // Configurator URL
    const configDomain = process.env.NEXT_PUBLIC_CONFIGURATOR_DOMAIN || 'https://unbreak-3-d-konfigurator.vercel.app';
    const redirectUrl = `${configDomain}/?lang=${currentLang}&return=${returnUrl}`;
    
    console.info('[SHOP] opening configurator', { url: configDomain, lang: currentLang });
    
    // FAIL-SAFE: Health check before opening
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
      
      const healthCheck = await fetch(configDomain, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (!healthCheck.ok) {
        throw new Error(`Status: ${healthCheck.status}`);
      }
      
      // Health check OK → Open configurator in new tab
      window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      
    } catch (error) {
      console.warn('[SHOP] configurator health check failed:', error.message);
      
      // Show user-friendly message
      const isTimeout = error.name === 'AbortError';
      const message = isTimeout 
        ? 'Der 3D-Konfigurator ist gerade nicht erreichbar.\n\nBitte versuchen Sie es in wenigen Minuten erneut.'
        : 'Der 3D-Konfigurator befindet sich in Wartung.\n\nBitte versuchen Sie es später erneut.';
      
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: sans-serif;
        animation: fadeIn 0.2s;
      `;
      
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        max-width: 400px;
        text-align: center;
      `;
      
      modal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Konfigurator nicht verfügbar</h3>
        <p style="color: #6b7280; margin: 0 0 24px 0; line-height: 1.6;">${message.replace(/\n\n/g, '<br><br>')}</p>
        <button id="closeModal" style="
          background: #059669;
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          font-weight: 500;
        ">OK, verstanden</button>
      `;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Close on click
      document.getElementById('closeModal').addEventListener('click', () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
      });
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 200);
        }
      });
    }
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
      {/* Inline CSS for modal animation */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

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
