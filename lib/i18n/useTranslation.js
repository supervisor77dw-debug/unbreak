/**
 * UNBREAK ONE - React i18n Hook
 * Bridge between vanilla i18n system and React components
 * 
 * Usage:
 * const { t, locale, setLocale } = useTranslation();
 * <h1>{t('shop.hero.title')}</h1>
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to access i18n in React components
 * Syncs with global window.i18n system
 */
export function useTranslation() {
  const [locale, setLocaleState] = useState('de');
  const [translations, setTranslations] = useState({ de: {}, en: {} });
  const [ready, setReady] = useState(false);

  // Initialize and sync with window.i18n
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initI18n = () => {
      if (window.i18n) {
        setLocaleState(window.i18n.getCurrentLanguage() || 'de');
        setTranslations(window.i18n.translations || { de: {}, en: {} });
        setReady(true);
      }
    };

    // Try immediate init
    initI18n();

    // Listen for i18n ready event (in case not loaded yet)
    const handleI18nReady = (e) => {
      setLocaleState(e.detail?.lang || 'de');
      if (window.i18n) {
        setTranslations(window.i18n.translations || { de: {}, en: {} });
      }
      setReady(true);
    };

    // Listen for language changes
    const handleLanguageChange = (e) => {
      const newLang = e.detail?.lang || e.detail?.locale || 'de';
      setLocaleState(newLang);
      if (window.i18n) {
        setTranslations(window.i18n.translations || { de: {}, en: {} });
      }
    };

    window.addEventListener('i18nReady', handleI18nReady);
    window.addEventListener('languageChanged', handleLanguageChange);

    return () => {
      window.removeEventListener('i18nReady', handleI18nReady);
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);

  /**
   * Translate a key with dot notation
   * @param {string} key - Translation key (e.g., 'shop.hero.title')
   * @param {object} params - Optional interpolation params
   * @returns {string} Translated text
   */
  const t = useCallback((key, params = {}) => {
    if (!key) return '';

    const keys = key.split('.');
    let value = translations[locale];

    // Navigate through nested object
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to 'de' if not found
    if (value === undefined && locale !== 'de') {
      let fallbackValue = translations['de'];
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object') {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }

      if (fallbackValue !== undefined) {
        value = fallbackValue;
      }
    }

    // If still not found, return key (better than empty)
    if (value === undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[I18N] Missing translation: ${key} (locale=${locale})`);
      }
      return key;
    }

    // Simple interpolation: {name} -> params.name
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return value;
  }, [locale, translations]);

  /**
   * Change language programmatically
   * Syncs with global i18n system
   */
  const setLocale = useCallback((newLocale) => {
    if (typeof window === 'undefined') return;
    
    if (window.i18n && typeof window.i18n.setLanguage === 'function') {
      window.i18n.setLanguage(newLocale);
    } else {
      // Fallback: set directly if i18n not ready
      setLocaleState(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem('unbreakone_lang', newLocale);
        document.cookie = `unbreakone_lang=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }
  }, []);

  return {
    t,
    locale,
    setLocale,
    ready,
  };
}
