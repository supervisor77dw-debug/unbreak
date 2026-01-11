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
   * Priority: URL param > Cookie > localStorage > browser language > default (de)
   */
  async init() {
    // Check URL param first (?lang=en)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    
    if (urlLang && ['de', 'en'].includes(urlLang)) {
      this.currentLang = urlLang;
      this.saveLocale(urlLang);
    } else {
      // Check cookie first (survives page transitions, SSR-compatible)
      const cookieLang = this.getCookie('unbreakone_lang');
      if (cookieLang && ['de', 'en'].includes(cookieLang)) {
        this.currentLang = cookieLang;
      } else {
        // Check localStorage (fallback)
        const savedLang = localStorage.getItem('unbreakone_lang');
        if (savedLang && ['de', 'en'].includes(savedLang)) {
          this.currentLang = savedLang;
          this.saveLocale(savedLang); // Sync to cookie
        } else {
          // Check browser language as fallback
          const browserLang = navigator.language.split('-')[0];
          if (browserLang === 'en') {
            this.currentLang = 'en';
          }
          this.saveLocale(this.currentLang); // Save initial locale
        }
      }
    }

    // Load translations
    await this.loadTranslations();
    
    // Update HTML lang attribute
    document.documentElement.lang = this.currentLang;
    
    // Update all i18n elements
    this.updateContent();
    
    // Update meta tags
    this.updateMetaTags();
    
    this.initialized = true;
    
    // Clean up any old debug elements (production safety)
    // Only in production without debug mode
    if (typeof window.UNBREAKONE_IS_PROD !== 'undefined' && window.UNBREAKONE_IS_PROD && !window.UNBREAKONE_IS_DEBUG) {
      const oldDebugElements = document.querySelectorAll(
        '.i18n-debug-indicator, .i18n-debug-badge, .debug-badge, .content-ok-badge, [class*="i18n-debug"]'
      );
      oldDebugElements.forEach(el => {
        // Don't remove configurator debug elements
        if (!el.closest('#debug-log') && !el.id?.includes('debug')) {
          el.remove();
        }
      });
    }
    
    // Dispatch event for other scripts
    window.dispatchEvent(new CustomEvent('i18nReady', { detail: { lang: this.currentLang } }));
  }

  /**
   * Load translation files
   */
  async loadTranslations() {
    try {
      const [deData, enData] = await Promise.all([
        fetch(`translations/de.json?v=${Date.now()}`).then(r => r.json()),
        fetch(`translations/en.json?v=${Date.now()}`).then(r => r.json())
      ]);
      
      this.translations = {
        de: deData,
        en: enData
      };
    } catch (error) {
      console.error('Failed to load translations:', error);
      // Fallback: keep empty translations
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
    
    // Navigate through nested object
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
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
        return fallbackValue;
      }
    }
    
    // If still not found, return the key itself (better than empty/crash)
    if (value === undefined) {
      console.warn(`[I18N] Missing translation: ${key} (lang=${this.currentLang})`);
      return key;
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
      
      if (translation) {
        element.textContent = translation;
      }
    });
    
    // Update HTML content (for elements with rich text)
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const key = element.getAttribute('data-i18n-html');
      const translation = this.t(key);
      
      if (translation) {
        element.innerHTML = translation;
      }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translation = this.t(key);
      
      if (translation) {
        element.placeholder = translation;
      }
    });
    
    // Update aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(element => {
      const key = element.getAttribute('data-i18n-aria');
      const translation = this.t(key);
      
      if (translation) {
        element.setAttribute('aria-label', translation);
      }
    });
    
    // Update alt texts
    document.querySelectorAll('[data-i18n-alt]').forEach(element => {
      const key = element.getAttribute('data-i18n-alt');
      const translation = this.t(key);
      
      if (translation) {
        element.alt = translation;
      }
    });
    
    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const translation = this.t(key);
      
      if (translation) {
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
    
    // Save to both cookie and localStorage
    this.saveLocale(lang);
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update all content
    this.updateContent();
    
    // Update meta tags
    this.updateMetaTags();
    
    // Dispatch events for language change
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    window.dispatchEvent(new CustomEvent('i18nLanguageChanged', { detail: { lang } }));
  }

  /**
   * Save locale to both cookie and localStorage
   */
  saveLocale(lang) {
    // Cookie (max-age 1 year, path /, SameSite=Lax for cross-page persistence)
    document.cookie = `unbreakone_lang=${lang}; max-age=31536000; path=/; SameSite=Lax`;
    
    // localStorage (backup)
    localStorage.setItem('unbreakone_lang', lang);
    
    console.log('[I18N] Saved locale:', lang);
  }

  /**
   * Get cookie value by name
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }
    return null;
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
