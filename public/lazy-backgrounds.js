/**
 * Lazy Load Background Images
 * Lädt große Background-Images nur wenn Section sichtbar wird
 */

(function() {
  'use strict';

  // Sections mit lazy Background Images
  const LAZY_BG_SECTIONS = [
    {
      selector: '#kontakt',
      image: 'images/Kontakt.jpg',
      rootMargin: '100px' // Lade 100px bevor Section sichtbar
    }
  ];

  function initLazyBackgrounds() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: Lade alle sofort wenn IntersectionObserver nicht verfügbar
      LAZY_BG_SECTIONS.forEach(config => {
        const element = document.querySelector(config.selector);
        if (element) {
          element.style.backgroundImage = `url('${config.image}')`;
        }
      });
      return;
    }

    LAZY_BG_SECTIONS.forEach(config => {
      const element = document.querySelector(config.selector);
      if (!element) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Section ist sichtbar → Lade Background Image
            element.style.backgroundImage = `url('${config.image}')`;
            element.style.transition = 'background-image 0.3s ease-in';
            
            console.log(`[Lazy BG] Loaded: ${config.image}`);
            observer.disconnect();
          }
        });
      }, {
        rootMargin: config.rootMargin || '50px',
        threshold: 0.01
      });

      observer.observe(element);
    });
  }

  // Init nach DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyBackgrounds);
  } else {
    initLazyBackgrounds();
  }
})();
