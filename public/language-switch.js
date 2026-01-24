/**
 * UNBREAK ONE - Language Switch UI
 * Interactive language switcher component
 */

(function() {
  'use strict';

  /**
   * Create and inject language switch UI into navbar
   */
  function createLanguageSwitch() {
    // Create container
    const switchContainer = document.createElement('div');
    switchContainer.className = 'language-switch';
    switchContainer.setAttribute('role', 'group');
    switchContainer.setAttribute('aria-label', 'Language selection');

    // Create German button
    const btnDe = document.createElement('button');
    btnDe.textContent = 'DE';
    btnDe.setAttribute('aria-label', 'Deutsch');
    btnDe.setAttribute('data-lang', 'de');
    btnDe.className = window.i18n?.getCurrentLanguage() === 'de' ? 'active' : '';

    // Create separator
    const separator = document.createElement('span');
    separator.className = 'separator';
    separator.setAttribute('aria-hidden', 'true');

    // Create English button
    const btnEn = document.createElement('button');
    btnEn.textContent = 'EN';
    btnEn.setAttribute('aria-label', 'English');
    btnEn.setAttribute('data-lang', 'en');
    btnEn.className = window.i18n?.getCurrentLanguage() === 'en' ? 'active' : '';

    // Assemble
    switchContainer.appendChild(btnDe);
    switchContainer.appendChild(separator);
    switchContainer.appendChild(btnEn);

    // Event handlers
    btnDe.addEventListener('click', () => switchLanguage('de', btnDe, btnEn));
    btnEn.addEventListener('click', () => switchLanguage('en', btnEn, btnDe));
    
    // ADDITIONAL: Pointer Events (for React/modern frameworks)
    btnDe.addEventListener('pointerdown', () => {
      console.info('[LANG_SWITCH] pointerdown on DE');
    });
    btnDe.addEventListener('pointerup', () => switchLanguage('de', btnDe, btnEn));
    
    btnEn.addEventListener('pointerdown', () => {
      console.info('[LANG_SWITCH] pointerdown on EN');
    });
    btnEn.addEventListener('pointerup', () => switchLanguage('en', btnEn, btnDe));

    // Keyboard navigation
    [btnDe, btnEn].forEach(btn => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const otherBtn = btn === btnDe ? btnEn : btnDe;
          otherBtn.focus();
        }
      });
    });

    return switchContainer;
  }

  /**
   * Switch language with visual feedback
   */
  function switchLanguage(lang, activeBtn, inactiveBtn) {
    console.info('[PARENT][LANG_SWITCH_CLICKED]', lang); // Explicit confirmation
    
    if (!window.i18n) {
      console.error('i18n system not loaded');
      return;
    }

    // Don't switch if already active
    if (activeBtn.classList.contains('active')) {
      console.info('[LANG_SWITCH] Already active:', lang);
      return;
    }

    // Add changing state for smooth transition
    document.body.classList.add('i18n-changing');

    // Update button states
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');

    // Switch language
    window.i18n.setLanguage(lang).then(() => {
      // Remove changing state after animation
      setTimeout(() => {
        document.body.classList.remove('i18n-changing');
      }, 150);
    });
  }

  /**
   * Inject language switch into navbar
   */
  function injectLanguageSwitch() {
    // Check if already injected
    if (document.querySelector('.language-switch')) {
      console.info('[LANG_SWITCH] Already injected');
      return;
    }

    // HARD REQUIREMENT: Mount only in #language-switch-mount
    const mountPoint = document.querySelector('#language-switch-mount');
    
    if (!mountPoint) {
      console.error('[LANG_SWITCH] CRITICAL: #language-switch-mount not found. Aborting injection.');
      console.error('[LANG_SWITCH] Header structure may be incomplete or timing issue (SSR/CSR).');
      console.error('[LANG_SWITCH] Ensure .header-controls contains <div id="language-switch-mount"></div>');
      return; // NO FALLBACK - fail explicitly
    }

    // Create and inject switch
    const languageSwitch = createLanguageSwitch();
    mountPoint.appendChild(languageSwitch);
    console.info('[LANG_SWITCH] Successfully mounted in #language-switch-mount');
  }

  /**
   * Update language switch when language changes externally
   */
  function updateLanguageSwitch(lang) {
    const btnDe = document.querySelector('.language-switch button[data-lang="de"]');
    const btnEn = document.querySelector('.language-switch button[data-lang="en"]');
    
    if (btnDe && btnEn) {
      if (lang === 'de') {
        btnDe.classList.add('active');
        btnEn.classList.remove('active');
      } else {
        btnEn.classList.add('active');
        btnDe.classList.remove('active');
      }
    }
  }

  /**
   * Initialize language switch
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectLanguageSwitch);
    } else {
      injectLanguageSwitch();
    }

    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
      updateLanguageSwitch(e.detail.lang);
    });

    // Listen for i18n ready event
    window.addEventListener('i18nReady', (e) => {
      updateLanguageSwitch(e.detail.lang);
    });
  }

  // Start
  init();

})();
