/**
 * Header Component - SINGLE SOURCE OF TRUTH
 * Deterministisches Layout: CSS Grid mit festen Positionen
 * Keine flex-order, keine conditional rendering
 * 
 * DOM Structure (IDENTICAL on all pages):
 * <header class="site-header">
 *   <nav class="header-nav">
 *     <div class="header-logo">...</div>
 *     <div class="header-controls">
 *       <div class="header-lang-slot">...</div>  ← Language Switch
 *       <button class="header-burger">...</button> ← Burger Menu
 *     </div>
 *     <ul class="nav-links">...</ul>
 *   </nav>
 * </header>
 */

// Load clientLogger if not already loaded
if (typeof window.clientLogger === 'undefined') {
  const script = document.createElement('script');
  script.src = '/lib/clientLogger.js';
  document.head.appendChild(script);
}

function getHeaderHTML(options = {}) {
  // Options: useAnchors (for index.html one-page navigation)
  const useAnchors = options.useAnchors || false;
  
  const links = useAnchors ? {
    home: '#hero',
    product: '#produkt',
    useCases: '#einsatzbereiche',
    gastro: '#gastro-hero',
    tech: '#technik',
    contact: '#kontakt'
  } : {
    home: 'index.html',
    product: 'produkt.html',
    useCases: 'einsatzbereiche.html',
    gastro: 'gastro-edition.html',
    tech: 'technik.html',
    contact: 'kontakt.html'
  };

  return `
  <header class="site-header">
    <nav class="header-nav">
      <!-- GRID AREA: logo (left) -->
      <div class="header-logo">
        <a href="index.html" class="logo-link">
          <img src="images/logo.png" alt="UNBREAK ONE" class="nav-logo">
        </a>
      </div>

      <!-- GRID AREA: controls (right, fixed position) -->
      <div class="header-controls">
        <!-- Language Switch Placeholder - filled by language-switch.js -->
        <div class="header-lang-slot" id="headerLangSlot"></div>
        
        <!-- Burger Menu - ALWAYS in this exact DOM position -->
        <button class="header-burger" id="burgerMenu" aria-label="Menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <!-- GRID AREA: nav (desktop: inline, mobile: slides in) -->
      <ul class="nav-links" id="navLinks">
        <li><a href="${links.home}" data-page="index" data-i18n="nav.home">Start</a></li>
        <li><a href="${links.product}" data-page="produkt" data-i18n="nav.product">Produkt</a></li>
        <li><a href="${links.useCases}" data-page="einsatzbereiche" data-i18n="nav.useCases">Einsatzbereiche</a></li>
        <li><a href="${links.gastro}" data-page="gastro-edition" data-i18n="nav.gastroEdition">Gastro Edition</a></li>
        <li><a href="${links.tech}" data-page="technik" data-i18n="nav.tech">Technik</a></li>
        <li><a href="configurator.html" data-page="configurator" data-i18n="nav.configurator">Konfigurator</a></li>
        <li><a href="/shop" data-page="shop" data-i18n="nav.shop">Shop</a></li>
        <li><a href="${links.contact}" data-page="kontakt" data-i18n="nav.contact">Kontakt</a></li>

        <!-- Mobile Only Legal Links -->
        <li class="mobile-only"><a href="impressum.html" data-page="impressum" data-i18n="nav.impressum">Impressum</a></li>
        <li class="mobile-only"><a href="datenschutz.html" data-page="datenschutz" data-i18n="nav.privacy">Datenschutz</a></li>
        <li class="mobile-only"><a href="agb.html" data-page="agb" data-i18n="nav.terms">AGB</a></li>

        <li><a href="/shop" class="btn btn-nav" data-i18n="nav.buyNow">Jetzt kaufen</a></li>
      </ul>
    </nav>
  </header>
  `;
}

/**
 * Setzt den aktiven Menüpunkt basierend auf aktueller Seite
 */
function setActiveMenuItem() {
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  
  const navLinks = document.querySelectorAll('.nav-links a[data-page]');
  navLinks.forEach(link => {
    const linkPage = link.getAttribute('data-page');
    
    if (linkPage === currentPage) {
      link.classList.add('active');
      link.parentElement.classList.add('active');
    } else {
      link.classList.remove('active');
      link.parentElement.classList.remove('active');
    }
  });
}

/**
 * Initialisiert den Header
 */
function initHeader() {
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    // Detect if anchors should be used:
    // 1. Explicit data-use-anchors="true" attribute
    // 2. Or automatically detect index.html
    const explicitAnchors = headerContainer.getAttribute('data-use-anchors') === 'true';
    const isIndex = window.location.pathname === '/' || 
                    window.location.pathname.endsWith('index.html') ||
                    window.location.pathname === '/index.html';
    
    const useAnchors = explicitAnchors || isIndex;
    
    headerContainer.innerHTML = getHeaderHTML({ useAnchors: useAnchors });
    setActiveMenuItem();
    
    // Initialize burger menu toggle
    initBurgerMenu();
    
    if (window.clientLogger) window.clientLogger.log('✓ Header loaded (deterministic layout, anchors=' + useAnchors + ')');
  } else {
    if (window.clientLogger) window.clientLogger.error('❌ Header container (#header-container) not found');
  }
}

/**
 * Burger Menu Toggle
 */
function initBurgerMenu() {
  const burger = document.getElementById('burgerMenu');
  const navLinks = document.getElementById('navLinks');
  
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('active');
      burger.classList.toggle('active', isOpen);
      burger.setAttribute('aria-expanded', isOpen);
    });
    
    // Close menu on nav link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        burger.classList.remove('active');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

// Automatisch beim Laden initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeader);
} else {
  initHeader();
}
