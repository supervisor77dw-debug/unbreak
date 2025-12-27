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
        <li><a href="shop.html" data-page="shop" data-i18n="nav.shop">Shop</a></li>
        <li><a href="kontakt.html" data-page="kontakt" data-i18n="nav.contact">Kontakt</a></li>

        <!-- Auth-based Links (will be populated by JS) -->
        <li id="auth-nav-container"></li>

        <!-- Mobile Only Legal Links -->
        <li class="mobile-only"><a href="impressum.html" data-page="impressum" data-i18n="nav.impressum">Impressum</a></li>
        <li class="mobile-only"><a href="datenschutz.html" data-page="datenschutz" data-i18n="nav.privacy">Datenschutz</a></li>
        <li class="mobile-only"><a href="agb.html" data-page="agb" data-i18n="nav.terms">AGB</a></li>

        <li><a href="/shop.html" class="btn btn-nav" data-i18n="nav.buyNow">Jetzt kaufen</a></li>
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
async function initHeader() {
  // Header-HTML einfügen
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    headerContainer.innerHTML = getHeaderHTML();
    
    // Active State setzen
    setActiveMenuItem();
    
    // Load checkout.js globally (for all pages)
    if (!document.querySelector('script[src*="checkout.js"]')) {
      const checkoutScript = document.createElement('script');
      checkoutScript.src = 'checkout.js';
      checkoutScript.defer = true;
      document.head.appendChild(checkoutScript);
      console.log('✓ Checkout.js loaded globally');
    }

    // Load Supabase client for auth check
    if (!document.querySelector('script[src*="@supabase/supabase-js"]')) {
      const supabaseScript = document.createElement('script');
      supabaseScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      supabaseScript.onload = initAuthNav;
      document.head.appendChild(supabaseScript);
    } else {
      initAuthNav();
    }
    
    console.log('✓ Header loaded');
  } else {
    console.error('❌ Header container (#header-container) not found');
  }
}

/**
 * Initialize auth-based navigation
 */
async function initAuthNav() {
  try {
    // Create Supabase client
    const supabaseUrl = 'YOUR_SUPABASE_URL'; // Will be replaced by build process
    const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // Will be replaced by build process
    
    if (!window.supabase) {
      console.log('Supabase not loaded yet, skipping auth nav');
      return;
    }

    const { createClient } = window.supabase;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Get current session
    const { data: { session } } = await supabaseClient.auth.getSession();

    const authContainer = document.getElementById('auth-nav-container');
    if (!authContainer) return;

    if (!session) {
      // Not logged in - show login link
      authContainer.innerHTML = '<a href="login.html" data-page="login">Login</a>';
    } else {
      // Logged in - get user role
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        let portalLinks = '';

        // Add appropriate portal link based on role
        if (profile.role === 'admin') {
          portalLinks = `
            <a href="admin.html" data-page="admin" style="color: #ff00ff;">Admin</a>
            <li><a href="ops.html" data-page="ops" style="color: #ff6b9d;">Ops</a></li>
            <li><a href="account.html" data-page="account">Konto</a></li>
          `;
        } else if (profile.role === 'staff') {
          portalLinks = `
            <a href="ops.html" data-page="ops" style="color: #ff6b9d;">Ops</a>
            <li><a href="account.html" data-page="account">Konto</a></li>
          `;
        } else {
          portalLinks = '<a href="account.html" data-page="account">Konto</a>';
        }

        authContainer.innerHTML = portalLinks;
        
        // Re-apply active state after adding auth links
        setActiveMenuItem();
      }
    }
  } catch (error) {
    console.error('Auth nav error:', error);
    // Silent fail - nav will just not show auth links
  }
}

// Automatisch beim Laden initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeader);
} else {
  initHeader();
}
