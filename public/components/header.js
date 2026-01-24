/**
 * Header Component - Wiederverwendbarer Header für alle Seiten
 * Automatische Active-State-Erkennung basierend auf aktueller URL
 * Auto-Collapse: Misst verfügbaren Platz und schaltet automatisch auf Burger um
 */

// Load clientLogger if not already loaded
if (typeof window.clientLogger === 'undefined') {
  const script = document.createElement('script');
  script.src = '/lib/clientLogger.js';
  document.head.appendChild(script);
}

function getHeaderHTML() {
  return `
  <header class="site-header">
    <div class="header-inner">
      <!-- LEFT BLOCK: Brand + Nav (springen zusammen) -->
      <div class="header-left">
        <!-- Logo -->
        <div class="header-brand">
          <a href="index.html" class="logo-link">
            <img src="images/logo.png" alt="UNBREAK ONE" class="nav-logo">
          </a>
        </div>

        <!-- Navigation -->
        <nav class="header-nav" aria-label="Primary">
          <ul class="nav-links header-nav-list" id="navLinks">
          <li><a href="index.html" data-page="index" data-i18n="nav.home">Start</a></li>
          <li><a href="produkt.html" data-page="produkt" data-i18n="nav.product">Produkt</a></li>
          <li><a href="einsatzbereiche.html" data-page="einsatzbereiche" data-i18n="nav.useCases">Einsatzbereiche</a></li>
          <li><a href="gastro-edition.html" data-page="gastro-edition" data-i18n="nav.gastroEdition">Gastro Edition</a></li>
          <li><a href="technik.html" data-page="technik" data-i18n="nav.tech">Technik</a></li>
          <li><a href="configurator.html" data-page="configurator" data-i18n="nav.configurator">Konfigurator</a></li>
          <li><a href="/shop" data-page="shop" data-i18n="nav.shop">Shop</a></li>
          <li><a href="kontakt.html" data-page="kontakt" data-i18n="nav.contact">Kontakt</a></li>
          </ul>
        </nav>
      </div>

      <!-- RIGHT BLOCK: Controls (CTA + Language + Burger) -->
      <div class="header-controls">
        <a href="/shop" class="btn btn-nav header-cta" data-i18n="nav.buyNow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
            <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" fill="currentColor"/>
          </svg>
          <span>Kaufen</span>
        </a>
        <!-- Mount-Point für Language-Switch (wird von language-switch.js injiziert) -->
        <div id="language-switch-mount"></div>
        <button class="burger-menu header-burger" id="burgerMenu" type="button" aria-label="Menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>

    <!-- MOBILE NAV PANEL (Offcanvas) -->
    <div class="mobile-nav-panel">
      <ul class="mobile-nav-list">
        <li><a href="index.html" data-page="index" data-i18n="nav.home">Start</a></li>
        <li><a href="produkt.html" data-page="produkt" data-i18n="nav.product">Produkt</a></li>
        <li><a href="einsatzbereiche.html" data-page="einsatzbereiche" data-i18n="nav.useCases">Einsatzbereiche</a></li>
        <li><a href="gastro-edition.html" data-page="gastro-edition" data-i18n="nav.gastroEdition">Gastro Edition</a></li>
        <li><a href="technik.html" data-page="technik" data-i18n="nav.tech">Technik</a></li>
        <li><a href="configurator.html" data-page="configurator" data-i18n="nav.configurator">Konfigurator</a></li>
        <li><a href="/shop" data-page="shop" data-i18n="nav.shop">Shop</a></li>
        <li><a href="kontakt.html" data-page="kontakt" data-i18n="nav.contact">Kontakt</a></li>
        <li class="divider"></li>
        <li><a href="impressum.html" data-page="impressum" data-i18n="nav.impressum">Impressum</a></li>
        <li><a href="datenschutz.html" data-page="datenschutz" data-i18n="nav.privacy">Datenschutz</a></li>
        <li><a href="agb.html" data-page="agb" data-i18n="nav.terms">AGB</a></li>
        <li class="divider"></li>
        <li><a href="/shop" class="btn btn-primary" data-i18n="nav.buyNow">Jetzt kaufen</a></li>
      </ul>
    </div>

    <!-- MOBILE NAV OVERLAY (Click-to-close) -->
    <div class="mobile-nav-overlay"></div>
  </header>
  `;
}

/**
 * Setzt den aktiven Menüpunkt basierend auf aktueller Seite
 */
function setActiveMenuItem() {
  // Aktuelle Seite ermitteln (z.B. "produkt.html" → "produkt")
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  
  // Alle Nav-Links durchgehen
  const navLinks = document.querySelectorAll('.nav-links a[data-page]');
  navLinks.forEach(link => {
    const linkPage = link.getAttribute('data-page');
    
    if (linkPage === currentPage) {
      link.classList.add('active');
      // Parent <li> auch markieren (falls CSS auf li.active reagiert)
      link.parentElement.classList.add('active');
    } else {
      link.classList.remove('active');
      link.parentElement.classList.remove('active');
    }
  });
}

/**
 * Burger-Menü Funktionalität (Click, Overlay, ESC)
 */
function setupBurgerMenu() {
  const burgerButton = document.querySelector('.header-burger');
  const mobilePanel = document.querySelector('.mobile-nav-panel');
  const overlay = document.querySelector('.mobile-nav-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-nav-list a');

  if (!burgerButton) {
    if (window.clientLogger) window.clientLogger.error('❌ BURGER NOT FOUND: .header-burger selector failed');
    return;
  }

  if (window.clientLogger) window.clientLogger.log('✓ Burger-Menu initialized');

  // Toggle Menu
  const toggleMenu = () => {
    const isOpen = document.body.classList.toggle('menu-open');
    burgerButton.setAttribute('aria-expanded', isOpen);
    burgerButton.classList.toggle('active', isOpen);
    if (window.clientLogger) window.clientLogger.log(isOpen ? '▶ Menu opened' : '◀ Menu closed');
  };

  // Close Menu
  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    burgerButton.setAttribute('aria-expanded', 'false');
    burgerButton.classList.remove('active');
    if (window.clientLogger) window.clientLogger.log('◀ Menu closed');
  };

  // Burger Click
  burgerButton.addEventListener('click', toggleMenu);

  // Overlay Click
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // ESC Key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenu();
    }
  });

  // Close on Link Click
  mobileLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });
}

/**
 * Initialisiert den Header
 */
function initHeader() {
  // Header-HTML einfügen
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    headerContainer.innerHTML = getHeaderHTML();
    
    // Active State setzen
    setActiveMenuItem();
    
    // Burger-Menü aktivieren
    setupBurgerMenu();
    
    if (window.clientLogger) window.clientLogger.log('✓ Header loaded with Burger-Menu');
  } else {
    if (window.clientLogger) window.clientLogger.error('❌ Header container (#header-container) not found');
  }
}

// Automatisch beim Laden initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeader);
} else {
  initHeader();
}
