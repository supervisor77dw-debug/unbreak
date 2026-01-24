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

// State für Progressive Collapse
let ctaHidden = false;
let isCollapsed = false;
let resizeObserver = null;

function getHeaderHTML() {
  return `
  <header class="site-header">
    <div class="header-inner">
      <!-- Logo Links -->
      <div class="header-brand">
        <a href="index.html" class="logo-link">
          <img src="images/logo.png" alt="UNBREAK ONE" class="nav-logo">
        </a>
      </div>

      <!-- Navigation Mittig -->
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

        <!-- Mobile Only Legal Links -->
        <li class="mobile-only"><a href="impressum.html" data-page="impressum" data-i18n="nav.impressum">Impressum</a></li>
        <li class="mobile-only"><a href="datenschutz.html" data-page="datenschutz" data-i18n="nav.privacy">Datenschutz</a></li>
        <li class="mobile-only"><a href="agb.html" data-page="agb" data-i18n="nav.terms">AGB</a></li>

        <!-- CTA im Mobile-Menü -->
        <li class="mobile-only"><a href="/shop" class="btn btn-nav" data-i18n="nav.buyNow">Jetzt kaufen</a></li>

        </ul>
      </nav>

      <!-- Controls Rechts: CTA + Language + Burger -->
      <div class="header-controls">
        <a href="/shop" class="btn btn-nav header-cta" data-i18n="nav.buyNow">Jetzt kaufen</a>
        <!-- Mount-Point für Language-Switch (wird von language-switch.js injiziert) -->
        <div id="language-switch-mount"></div>
        <div class="burger-menu header-burger" id="burgerMenu" aria-label="Menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
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
 * Progressive Collapse: 3 Stufen (Normal → CTA hidden → Burger)
 */
function setupAutoCollapse() {
  const headerInner = document.querySelector('.header-inner');
  const headerBrand = document.querySelector('.header-brand');
  const headerNav = document.querySelector('.header-nav');
  const headerControls = document.querySelector('.header-controls');
  const burgerMenu = document.querySelector('.burger-menu');
  const ctaButton = document.querySelector('.header-controls .btn-nav');

  if (!headerInner || !headerBrand || !headerNav || !headerControls) {
    return;
  }

  function checkSpace() {
    const available = headerInner.clientWidth;
    const neededBrand = headerBrand.scrollWidth;
    const neededNav = headerNav.scrollWidth;
    const neededControls = headerControls.scrollWidth;
    const gaps = 32; // 2x column-gap 16px

    // Stufe 1: Mit CTA
    let neededTotal = neededBrand + neededNav + neededControls + gaps;

    if (neededTotal > available && !ctaHidden) {
      // Stufe 2: CTA verstecken
      ctaHidden = true;
      if (ctaButton) ctaButton.style.display = 'none';
      // Neu messen nach DOM-Update
      setTimeout(checkSpace, 0);
      return;
    }

    if (ctaHidden && ctaButton) {
      // Neu messen ohne CTA
      const neededCTA = ctaButton.scrollWidth;
      neededTotal = neededBrand + neededNav + (neededControls - neededCTA) + gaps;
    }

    // Stufe 3: Burger aktivieren wenn immer noch nicht genug Platz
    const shouldCollapse = neededTotal > available;

    if (shouldCollapse !== isCollapsed) {
      isCollapsed = shouldCollapse;
      
      if (isCollapsed) {
        headerNav.classList.add('collapsed');
        burgerMenu.classList.add('visible');
      } else {
        headerNav.classList.remove('collapsed');
        burgerMenu.classList.remove('visible');
      }
    }

    // Wenn genug Platz: CTA wieder anzeigen
    if (ctaHidden && !isCollapsed && ctaButton) {
      const neededWithCTA = neededBrand + neededNav + neededControls + gaps;
      if (neededWithCTA <= available) {
        ctaHidden = false;
        ctaButton.style.display = 'inline-block';
      }
    }
  }

  // Initiale Messung nach kurzer Verzögerung
  setTimeout(checkSpace, 50);

  // ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  
  resizeObserver = new ResizeObserver(() => {
    checkSpace();
  });

  resizeObserver.observe(headerInner);
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
    
    // Auto-Collapse aktivieren
    setTimeout(() => {
      setupAutoCollapse();
    }, 100);
    
    // Burger Menu Event (wird von script.js gehandhabt, aber wir stellen sicher dass IDs existieren)
    if (window.clientLogger) window.clientLogger.log('✓ Header loaded with auto-collapse');
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
