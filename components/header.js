/**
 * Header Component - Wiederverwendbarer Header für alle Seiten
 * Automatische Active-State-Erkennung basierend auf aktueller URL
 */

function getHeaderHTML() {
  return `
  <header>
    <nav>
      <div class="logo">
        <a href="index.html" class="logo-link">
          <img src="images/logo.png" alt="UNBREAK ONE" class="nav-logo">
        </a>
      </div>

      <!-- Mobile Burger Menu -->
      <div class="burger-menu" id="burgerMenu">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <!-- Navigation Links -->
      <ul class="nav-links" id="navLinks">
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
 * Initialisiert den Header
 */
function initHeader() {
  // Header-HTML einfügen
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    headerContainer.innerHTML = getHeaderHTML();
    
    // Active State setzen
    setActiveMenuItem();
    
    // Burger Menu Event (wird von script.js gehandhabt, aber wir stellen sicher dass IDs existieren)
    console.log('✓ Header loaded');
  } else {
    console.error('❌ Header container (#header-container) not found');
  }
}

// Automatisch beim Laden initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeader);
} else {
  initHeader();
}
