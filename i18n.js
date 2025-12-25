/**
 * UNBREAK ONE - i18n System
 * Lightweight internationalization for vanilla JavaScript
 * Supports: localStorage persistence, URL params, dynamic content updates
 */

class I18n {
  constructor() {
    this.currentLang = 'de'; // Default language
    this.translations = {};
    this.fallbackLang = 'de';
    this.initialized = false;
  }

  /**
   * Initialize i18n system
   * Priority: URL param > localStorage > browser language > default (de)
   */
  async init() {
    console.log('🌍 i18n: Initializing...');
    
    // Check URL param first (?lang=en)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    
    if (urlLang && ['de', 'en'].includes(urlLang)) {
      this.currentLang = urlLang;
      localStorage.setItem('unbreakone_lang', urlLang);
      console.log(`🌍 i18n: Language from URL: ${urlLang}`);
    } else {
      // Check localStorage
      const savedLang = localStorage.getItem('unbreakone_lang');
      if (savedLang && ['de', 'en'].includes(savedLang)) {
        this.currentLang = savedLang;
        console.log(`🌍 i18n: Language from localStorage: ${savedLang}`);
      } else {
        // Check browser language as fallback
        const browserLang = navigator.language.split('-')[0];
        if (browserLang === 'en') {
          this.currentLang = 'en';
          console.log(`🌍 i18n: Language from browser: en`);
        } else {
          console.log(`🌍 i18n: Using default language: de`);
        }
      }
    }

    // Load translations
    await this.loadTranslations();
    
    console.log(`🌍 i18n: Translations loaded:`, {
      currentLang: this.currentLang,
      deKeys: Object.keys(this.translations.de || {}).length,
      enKeys: Object.keys(this.translations.en || {}).length,
      deTopLevel: Object.keys(this.translations.de || {}),
      sampleDE: {
        'hero.title': this.t('hero.title'),
        'nav.home': this.t('nav.home'),
        'nav.product': this.t('nav.product')
      }
    });
    
    // Update HTML lang attribute
    document.documentElement.lang = this.currentLang;
    
    // Update all i18n elements
    this.updateContent();
    
    // Update meta tags
    this.updateMetaTags();
    
    this.initialized = true;
    
    // Add debug indicator
    this.addDebugIndicator();
    
    console.log('✅ i18n: Initialization complete');
    
    // Final diagnostic check
    console.group('🔍 i18n Final Diagnostic');
    console.log('Language:', this.currentLang);
    console.log('Initialized:', this.initialized);
    console.log('Translations Object:', this.translations);
    console.log('DE Keys:', Object.keys(this.translations.de || {}).length);
    console.log('EN Keys:', Object.keys(this.translations.en || {}).length);
    console.log('Test t("hero.title"):', this.t('hero.title'));
    console.log('Test t("nav.home"):', this.t('nav.home'));
    console.groupEnd();
    
    // Dispatch event for other scripts
    window.dispatchEvent(new CustomEvent('i18nReady', { detail: { lang: this.currentLang } }));
  }

  /**
   * Add visual debug indicator
   */
  addDebugIndicator() {
    const hasTranslations = this.translations.de && Object.keys(this.translations.de).length > 0;
    const deCount = Object.keys(this.translations.de || {}).length;
    const enCount = Object.keys(this.translations.en || {}).length;
    
    const indicator = document.createElement('div');
    indicator.id = 'i18n-debug';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      padding: 8px 16px;
      background: ${hasTranslations ? '#00FFDC' : '#FF4444'};
      color: #000;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      border-radius: 4px;
      z-index: 99999;
      pointer-events: none;
      opacity: 0.9;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    indicator.innerHTML = hasTranslations 
      ? `✅ CONTENT OK (${this.currentLang.toUpperCase()})<br><small>DE: ${deCount} | EN: ${enCount} keys</small>` 
      : `❌ CONTENT FALLBACK<br><small>No translations loaded</small>`;
    
    document.body.appendChild(indicator);
    
    // Click to toggle detailed debug
    indicator.style.pointerEvents = 'auto';
    indicator.style.cursor = 'pointer';
    indicator.addEventListener('click', () => {
      console.group('🌍 i18n Debug Info');
      console.log('Current Language:', this.currentLang);
      console.log('DE Keys Count:', deCount);
      console.log('EN Keys Count:', enCount);
      console.log('DE Top-Level Keys:', Object.keys(this.translations.de || {}));
      console.log('Sample Translations:', {
        'hero.title': this.t('hero.title'),
        'hero.subtitle': this.t('hero.subtitle'),
        'hero.cta': this.t('hero.cta'),
        'nav.home': this.t('nav.home'),
        'nav.product': this.t('nav.product')
      });
      console.log('Full DE Translations:', this.translations.de);
      console.log('Full EN Translations:', this.translations.en);
      console.groupEnd();
    });
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      indicator.style.transition = 'opacity 0.5s';
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 500);
    }, 8000);
  }

  /**
   * Load translation files
   */
  async loadTranslations() {
    try {
      console.log('🌍 i18n: Loading translation files...');
      const [deData, enData] = await Promise.all([
        fetch(`translations/de.json?v=${Date.now()}`).then(r => {
          if (!r.ok) throw new Error(`Failed to load de.json: ${r.status}`);
          return r.json();
        }),
        fetch(`translations/en.json?v=${Date.now()}`).then(r => {
          if (!r.ok) throw new Error(`Failed to load en.json: ${r.status}`);
          return r.json();
        })
      ]);
      
      this.translations = {
        de: deData,
        en: enData
      };
      
      console.log('✅ i18n: Translation files loaded successfully');
    } catch (error) {
      console.error('❌ i18n: Failed to load translations:', error);
      // Fallback: keep empty translations - HTML fallback texts will be preserved
      this.translations = { de: {}, en: {} };
    }
  }

  /**
   * Get translation for a key
   * Supports nested keys with dot notation (e.g., "hero.title")
   */
  t(key) {
    if (!key) return '';
    
    const keys = key.split('.');
    let value = this.translations[this.currentLang];
    
    // Debug: Log translation lookup
    const debugMode = window.location.search.includes('debug=1');
    if (debugMode) {
      console.log(`🔍 t("${key}") - currentLang: ${this.currentLang}`);
    }
    
    // Navigate through nested object
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
    
    if (debugMode && value !== undefined) {
      console.log(`✅ t("${key}") = "${value}"`);
    }
    
    // Fallback to default language if not found
    if (value === undefined && this.currentLang !== this.fallbackLang) {
      let fallbackValue = this.translations[this.fallbackLang];
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object') {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      
      if (fallbackValue !== undefined) {
        if (debugMode) {
          console.warn(`⚠️ Translation missing for key "${key}" in language "${this.currentLang}", using fallback: "${fallbackValue}"`);
        }
        return fallbackValue;
      }
    }
    
    if (value === undefined) {
      console.warn(`❌ Translation missing for key "${key}" - returning empty string to preserve HTML fallback`);
      return ''; // Return empty string instead of key - preserve HTML fallback
    }
    
    return value;
  }

  /**
   * Update all elements with data-i18n attribute
   */
  updateContent() {
    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);
      
      // Only update if translation exists (not empty)
      if (translation && translation !== key) {
        element.textContent = translation;
      }
    });
    
    // Update HTML content (for elements with rich text)
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const key = element.getAttribute('data-i18n-html');
      const translation = this.t(key);
      
      if (translation && translation !== key) {
        element.innerHTML = translation;
      }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translation = this.t(key);
      
      if (translation && translation !== key) {
        element.placeholder = translation;
      }
    });
    
    // Update aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(element => {
      const key = element.getAttribute('data-i18n-aria');
      const translation = this.t(key);
      
      if (translation && translation !== key) {
        element.setAttribute('aria-label', translation);
      }
    });
    
    // Update alt texts
    document.querySelectorAll('[data-i18n-alt]').forEach(element => {
      const key = element.getAttribute('data-i18n-alt');
      const translation = this.t(key);
      
      if (translation && translation !== key) {
        element.alt = translation;
      }
    });
    
    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const translation = this.t(key);
      
      if (translation && translation !== key) {
        element.title = translation;
      }
    });
  }

  /**
   * Update page meta tags (title, description)
   */
  updateMetaTags() {
    // Update page title
    const titleKey = document.querySelector('meta[name="i18n-title"]')?.content;
    if (titleKey) {
      document.title = this.t(titleKey);
    } else {
      // Default title
      document.title = this.t('meta.title');
    }
    
    // Update meta description
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.content = this.t('meta.description');
    }
    
    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.content = this.t('meta.ogTitle');
    }
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.content = this.t('meta.ogDescription');
    }
    
    // Update Twitter tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.content = this.t('meta.twitterTitle');
    }
    
    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) {
      twitterDesc.content = this.t('meta.twitterDescription');
    }
  }

  /**
   * Switch language
   */
  async setLanguage(lang) {
    if (!['de', 'en'].includes(lang)) {
      console.error(`Unsupported language: ${lang}`);
      return;
    }
    
    if (lang === this.currentLang) {
      return; // Already in this language
    }
    
    this.currentLang = lang;
    
    // Save to localStorage
    localStorage.setItem('unbreakone_lang', lang);
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update all content
    this.updateContent();
    
    // Update meta tags
    this.updateMetaTags();
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this.currentLang;
  }
}

// Create global instance
window.i18n = new I18n();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.i18n.init());
} else {
  window.i18n.init();
}
