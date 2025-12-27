/**
 * Page Wrapper - Sauberer Startpunkt für alle Seiten
 * 
 * Sorgt für:
 * - Konsistenten Top-Abstand unter dem Header
 * - Scroll-to-top bei Navigation
 * - Keine Anchor-Offsets
 * - OnePager-Gefühl trotz Multi-Page
 */

const PageWrapper = {
  
  /**
   * Initialisiert den Page Wrapper
   */
  init() {
    this.ensureCleanStart();
    this.setupSmoothNavigation();
    console.log('✓ Page Wrapper initialized');
  },
  
  /**
   * Stellt sicher, dass Seite sauber unter Header startet
   */
  ensureCleanStart() {
    // Scroll auf (0, 0) beim Laden
    if (window.location.hash) {
      // Wenn Hash vorhanden (#section), entfernen und neu laden ohne Hash
      history.replaceState(null, null, window.location.pathname);
    }
    
    // Sofort nach oben scrollen
    window.scrollTo(0, 0);
    
    // Nach vollständigem Laden nochmal sicherstellen
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    });
  },
  
  /**
   * Smooth Navigation Setup (OnePager-Gefühl)
   */
  setupSmoothNavigation() {
    // Bei Navigation: smooth scroll to top
    window.addEventListener('beforeunload', () => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    
    // Alle internen Links abfangen für smooth transition
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      
      // Nur interne Links (keine externen, keine Anchors)
      if (href && 
          !href.startsWith('#') && 
          !href.startsWith('http') && 
          !href.startsWith('mailto') &&
          href.endsWith('.html')) {
        
        // Optional: Fade-out Animation vor Navigation
        // (kann aktiviert werden für OnePager-Gefühl)
        // document.body.style.opacity = '0.8';
      }
    });
  },
  
  /**
   * Header-Höhe ermitteln (für Spacing-Berechnungen)
   */
  getHeaderHeight() {
    const header = document.querySelector('header');
    return header ? header.offsetHeight : 80; // Fallback 80px
  },
  
  /**
   * Smooth Scroll zu bestimmter Position
   */
  scrollTo(position = 0, behavior = 'smooth') {
    window.scrollTo({
      top: position,
      behavior: behavior
    });
  }
  
};

// Auto-Init beim Laden
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PageWrapper.init());
} else {
  PageWrapper.init();
}
