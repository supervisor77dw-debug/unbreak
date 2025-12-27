/**
 * UNBREAK ONE - Header Theme Controller (STABLE)
 * PRIO 1: Einfach, robust, keine Bugs
 */

(function() {
  'use strict';
  
  const header = document.querySelector('header');
  if (!header) return;
  
  // PRIO 1: Initial State = Light (wie vorher)
  function setHeaderTheme(theme) {
    // IMMER beide entfernen, dann genau eine setzen (keine Toggle-Orgien)
    header.classList.remove('header--light', 'header--dark');
    header.classList.add(theme === 'dark' ? 'header--dark' : 'header--light');
  }
  
  // Initial: Light
  setHeaderTheme('light');
  
  // IntersectionObserver: Nur für Sections mit data-header
  const observerOptions = {
    root: null,
    rootMargin: '-80px 0px 0px 0px', // Header-Höhe
    threshold: 0
  };
  
  let currentTheme = 'light';
  
  const observer = new IntersectionObserver((entries) => {
    // Finde die oberste sichtbare Section mit data-header
    let topSection = null;
    let topY = Infinity;
    
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const rect = entry.target.getBoundingClientRect();
        if (rect.top < topY) {
          topY = rect.top;
          topSection = entry.target;
        }
      }
    });
    
    // Theme setzen basierend auf oberster Section
    if (topSection) {
      const newTheme = topSection.getAttribute('data-header') || 'light';
      if (newTheme !== currentTheme) {
        currentTheme = newTheme;
        setHeaderTheme(newTheme);
      }
    } else {
      // Keine Section sichtbar = Default Light
      if (currentTheme !== 'light') {
        currentTheme = 'light';
        setHeaderTheme('light');
      }
    }
  }, observerOptions);
  
  // Observe all sections with data-header
  const sections = document.querySelectorAll('[data-header]');
  sections.forEach(section => observer.observe(section));
  
  // Cleanup
  window.addEventListener('pagehide', () => {
    observer.disconnect();
  });
  
})();
