/**
 * Footer Component - Wiederverwendbarer Footer für alle Seiten
 */

function getFooterHTML() {
  return `
  <footer data-scroll-reveal="fade-up">
    <div class="container">
      <p>
        <a href="impressum.html" data-i18n="footer.impressum">Impressum</a> |
        <a href="datenschutz.html" data-i18n="footer.privacy">Datenschutz</a> |
        <a href="agb.html" data-i18n="footer.terms">AGB</a>
      </p>
    </div>
  </footer>
  `;
}

/**
 * Initialisiert den Footer
 */
function initFooter() {
  const footerContainer = document.getElementById('footer-container');
  if (footerContainer) {
    footerContainer.innerHTML = getFooterHTML();
    console.log('✓ Footer loaded');
  } else {
    console.error('❌ Footer container (#footer-container) not found');
  }
}

// Automatisch beim Laden initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFooter);
} else {
  initFooter();
}
