/**
 * UNBREAK ONE - UI Message Standard (Shop, Production-Ready)
 * 
 * PRINZIPIEN:
 * - So wenig Meldungen wie möglich
 * - Keine technischen Begriffe (API, Webhook, Trace, Snapshot)
 * - Keine Erfolgsmeldungen für interne Prozesse
 * - Fehler nur wenn Nutzer etwas tun muss
 * - DE & EN immer paarweise
 * 
 * USAGE:
 *   import { getMessage, showUserMessage } from '../lib/uiMessages';
 *   showUserMessage('addToCart', 'success', currentLang);
 */

/**
 * Zentrale UI Messages (Shop only - kein Admin)
 */
export const UI_MESSAGES = {
  // 1️⃣ ADD TO CART (Optional - kann auch ganz weg)
  addToCart: {
    de: 'Zum Warenkorb hinzugefügt',
    en: 'Added to cart',
  },

  // 2️⃣ VALIDIERUNGSFEHLER
  requiredFields: {
    de: 'Bitte alle erforderlichen Angaben auswählen.',
    en: 'Please select all required options.',
  },
  
  configUnavailable: {
    de: 'Diese Konfiguration ist derzeit nicht verfügbar.',
    en: 'This configuration is currently unavailable.',
  },

  // 3️⃣ CHECKOUT / ZAHLUNG
  paymentFailed: {
    de: 'Die Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    en: 'The payment could not be completed. Please try again.',
  },

  genericError: {
    de: 'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut.',
    en: 'An unexpected error occurred. Please try again later.',
  },

  // 4️⃣ WARENKORB
  cartLoadFailed: {
    de: 'Der Warenkorb konnte nicht geladen werden. Bitte lade die Seite neu.',
    en: 'Cart could not be loaded. Please reload the page.',
  },

  cartAddFailed: {
    de: 'Produkt konnte nicht hinzugefügt werden. Bitte versuche es erneut.',
    en: 'Product could not be added. Please try again.',
  },

  // 5️⃣ KONFIGURATION (Konfigurator-Return)
  configNotFound: {
    de: 'Die Konfiguration wurde nicht gefunden.',
    en: 'Configuration not found.',
  },

  configLoadFailed: {
    de: 'Die Konfiguration konnte nicht geladen werden. Bitte versuche es erneut.',
    en: 'Configuration could not be loaded. Please try again.',
  },
};

/**
 * Get message in specific language
 * @param {string} key - Message key from UI_MESSAGES
 * @param {string} lang - Language ('de' or 'en')
 * @returns {string} Translated message
 */
export function getMessage(key, lang = 'de') {
  const message = UI_MESSAGES[key];
  if (!message) {
    console.error(`[uiMessages] Unknown message key: ${key}`);
    return UI_MESSAGES.genericError[lang] || UI_MESSAGES.genericError.de;
  }
  return message[lang] || message.de;
}

/**
 * Show user message as toast
 * @param {string} key - Message key from UI_MESSAGES
 * @param {string} type - 'success' or 'error'
 * @param {string} lang - Language ('de' or 'en')
 * @param {number} duration - Duration in ms (default: 2000 for success, 4000 for error)
 */
export function showUserMessage(key, type = 'success', lang = 'de', duration = null) {
  const message = getMessage(key, lang);
  const defaultDuration = type === 'error' ? 4000 : 2000;
  const finalDuration = duration !== null ? duration : defaultDuration;
  
  showToast(message, type, finalDuration);
}

/**
 * Show toast notification (internal implementation)
 * @param {string} message - Message text
 * @param {string} type - 'success' or 'error'
 * @param {number} duration - Duration in ms
 */
function showToast(message, type = 'success', duration = 2000) {
  if (typeof document === 'undefined') return;
  
  const bgColor = type === 'success' ? '#059669' : '#dc2626';
  const icon = type === 'success' ? '' : ''; // Kein Icon-Zirkus
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
    max-width: 320px;
  `;
  notification.textContent = `${icon}${message}`.trim();
  document.body.appendChild(notification);
  
  // Auto-remove after duration
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.2s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 200);
  }, duration);
  
  // Add animations if not exist
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Get current language from window.i18n
 * Fallback to 'de' if not available
 */
export function getCurrentLang() {
  if (typeof window !== 'undefined' && window.i18n) {
    return window.i18n.getCurrentLanguage() || 'de';
  }
  return 'de';
}
