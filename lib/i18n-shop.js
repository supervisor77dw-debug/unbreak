/**
 * Shop i18n Translations
 * Cart, Checkout, and Email translations
 * Single source of truth for shop-related strings
 */

export const shopTranslations = {
  de: {
    cart: {
      title: "Warenkorb",
      empty: "Ihr Warenkorb ist leer",
      emptyCta: "Zum Shop",
      item: "Artikel",
      items: "Artikel",
      quantity: "Menge",
      price: "Preis",
      total: "Gesamt",
      remove: "Entfernen",
      update: "Aktualisieren",
      subtotal: "Zwischensumme",
      shipping: "Versand",
      freeShipping: "Kostenlos",
      shippingCalculated: "wird an der Kasse berechnet",
      tax: "MwSt.",
      taxIncluded: "inkl. {rate}% MwSt.",
      grandTotal: "Gesamtsumme",
      continueShopping: "Weiter einkaufen",
      checkout: "Zur Kasse",
      redirectingToStripe: "Weiterleitung zu Stripe...",
      added: "Artikel wurde zum Warenkorb hinzugefügt",
      updated: "Warenkorb wurde aktualisiert",
      removed: "Artikel wurde entfernt",
      error: "Fehler beim Aktualisieren des Warenkorbs",
      invalidQuantity: "Ungültige Menge",
      maxQuantity: "Maximale Menge erreicht ({max})",
      configured: "Konfiguriert",
      customProduct: "Individuelles Produkt",
      itemCount: "{count} Artikel",
      itemCountSingular: "1 Artikel"
    },
    checkout: {
      title: "Kasse",
      stepPayment: "Zahlung",
      stepShipping: "Versand",
      stepReview: "Überprüfen",
      orderSummary: "Bestellübersicht",
      shippingAddress: "Versandadresse",
      billingAddress: "Rechnungsadresse",
      sameAsShipping: "Rechnungsadresse = Versandadresse",
      paymentMethod: "Zahlungsmethode",
      cardNumber: "Kartennummer",
      expiryDate: "Ablaufdatum",
      cvv: "CVV",
      placeOrder: "Jetzt kaufen",
      processing: "Zahlung wird verarbeitet...",
      success: "Bestellung erfolgreich!",
      error: "Fehler bei der Bestellung",
      orderNumber: "Bestellnummer",
      thankYou: "Vielen Dank für Ihre Bestellung!",
      confirmationEmail: "Sie erhalten in Kürze eine Bestätigung per E-Mail.",
      backToShop: "Zurück zum Shop",
      required: "Pflichtfeld",
      invalidEmail: "Ungültige E-Mail-Adresse",
      invalidCard: "Ungültige Kartennummer",
      paymentFailed: "Zahlung fehlgeschlagen. Bitte versuchen Sie es erneut.",
      sessionExpired: "Ihre Sitzung ist abgelaufen. Bitte versuchen Sie es erneut.",
      loading: "Lädt...",
      proceedToPayment: "Weiter zur Zahlung"
    },
    email: {
      customer: {
        subject: "Bestellbestätigung - Bestellung {orderNumber}",
        greeting: "Hallo {name},",
        greetingDefault: "Hallo,",
        thanks: "vielen Dank für Ihre Bestellung bei UNBREAK ONE!",
        orderConfirmed: "Ihre Bestellung wurde erfolgreich bestätigt.",
        orderNumber: "Bestellnummer",
        orderDate: "Bestelldatum",
        items: "Bestellte Artikel",
        quantity: "Menge",
        price: "Preis",
        subtotal: "Zwischensumme",
        shipping: "Versand",
        tax: "MwSt.",
        total: "Gesamtsumme",
        shippingAddress: "Lieferadresse",
        paymentMethod: "Zahlungsmethode",
        estimatedDelivery: "Voraussichtliche Lieferung: {days} Werktage",
        questions: "Bei Fragen kontaktieren Sie uns gerne",
        footer: "UNBREAK ONE - Magnetische Halter für Gläser & Flaschen",
        unsubscribe: "Abmelden",
        privacy: "Datenschutz",
        imprint: "Impressum",
        configured: "Konfiguriert",
        viewOrder: "Bestellung anzeigen"
      },
      admin: {
        subject: "Neue Bestellung - {orderNumber}",
        newOrder: "Neue Bestellung eingegangen",
        orderDetails: "Bestelldetails",
        customerInfo: "Kundeninformationen",
        customerName: "Name",
        customerEmail: "E-Mail",
        orderNumber: "Bestellnummer",
        orderDate: "Bestelldatum",
        items: "Artikel",
        shippingAddress: "Versandadresse",
        total: "Gesamtsumme",
        viewInAdmin: "Im Admin-Panel anzeigen",
        configured: "Konfiguriert - Details im Admin-Panel"
      }
    },
    messages: {
      addToCart: "Artikel wurde zum Warenkorb hinzugefügt",
      cartAddFailed: "Artikel konnte nicht zum Warenkorb hinzugefügt werden",
      cartLoadFailed: "Warenkorb konnte nicht geladen werden",
      configLoadFailed: "Konfiguration konnte nicht geladen werden",
      checkoutSuccess: "Bestellung erfolgreich!",
      checkoutFailed: "Bestellung fehlgeschlagen. Bitte versuchen Sie es erneut.",
      sessionExpired: "Sitzung abgelaufen. Bitte laden Sie die Seite neu.",
      networkError: "Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung."
    },
    success: {
      loading: {
        title: "Bestellung wird verarbeitet",
        message: "Bestellung wird verarbeitet..."
      },
      error: {
        title: "Fehler",
        heading: "Fehler bei der Bestellverarbeitung",
        backToShop: "Zurück zum Shop"
      },
      success: {
        title: "Bestellung erfolgreich",
        heading: "Bestellung erfolgreich!",
        message: "Vielen Dank für Ihre Bestellung. Wir haben eine Bestätigungs-E-Mail an Ihre angegebene Adresse gesendet."
      },
      orderInfo: {
        orderNumber: "Bestellnummer:",
        totalAmount: "Gesamtbetrag:"
      },
      nextSteps: {
        title: "Wie geht es weiter?",
        step1: "Sie erhalten eine Bestätigungs-E-Mail mit allen Details",
        step2: "Ihr UNBREAK ONE wird individuell für Sie gefertigt",
        step3: "Versand erfolgt innerhalb von 3-5 Werktagen",
        step4: "Sie erhalten eine Tracking-Nummer per E-Mail"
      },
      actions: {
        toHome: "Zur Startseite",
        continueShopping: "Weiter einkaufen"
      },
      support: {
        question: "Fragen zu Ihrer Bestellung?",
        contactUs: "Kontaktieren Sie uns"
      }
    }
  },
  en: {
    cart: {
      title: "Shopping Cart",
      empty: "Your cart is empty",
      emptyCta: "Go to Shop",
      item: "Item",
      items: "Items",
      quantity: "Quantity",
      price: "Price",
      total: "Total",
      remove: "Remove",
      update: "Update",
      subtotal: "Subtotal",
      shipping: "Shipping",
      freeShipping: "Free",
      shippingCalculated: "calculated at checkout",
      tax: "VAT",
      taxIncluded: "incl. {rate}% VAT",
      grandTotal: "Grand Total",
      continueShopping: "Continue Shopping",
      checkout: "Proceed to Checkout",
      redirectingToStripe: "Redirecting to Stripe...",
      added: "Item added to cart",
      updated: "Cart updated",
      removed: "Item removed",
      error: "Error updating cart",
      invalidQuantity: "Invalid quantity",
      maxQuantity: "Maximum quantity reached ({max})",
      configured: "Configured",
      customProduct: "Custom Product",
      itemCount: "{count} items",
      itemCountSingular: "1 item"
    },
    checkout: {
      title: "Checkout",
      stepPayment: "Payment",
      stepShipping: "Shipping",
      stepReview: "Review",
      orderSummary: "Order Summary",
      shippingAddress: "Shipping Address",
      billingAddress: "Billing Address",
      sameAsShipping: "Same as shipping address",
      paymentMethod: "Payment Method",
      cardNumber: "Card Number",
      expiryDate: "Expiry Date",
      cvv: "CVV",
      placeOrder: "Place Order",
      processing: "Processing payment...",
      success: "Order successful!",
      error: "Order error",
      orderNumber: "Order Number",
      thankYou: "Thank you for your order!",
      confirmationEmail: "You will receive a confirmation email shortly.",
      backToShop: "Back to Shop",
      required: "Required",
      invalidEmail: "Invalid email address",
      invalidCard: "Invalid card number",
      paymentFailed: "Payment failed. Please try again.",
      sessionExpired: "Your session has expired. Please try again.",
      loading: "Loading...",
      proceedToPayment: "Proceed to Payment"
    },
    email: {
      customer: {
        subject: "Order Confirmation - Order {orderNumber}",
        greeting: "Hello {name},",
        greetingDefault: "Hello,",
        thanks: "thank you for your order at UNBREAK ONE!",
        orderConfirmed: "Your order has been successfully confirmed.",
        orderNumber: "Order Number",
        orderDate: "Order Date",
        items: "Ordered Items",
        quantity: "Quantity",
        price: "Price",
        subtotal: "Subtotal",
        shipping: "Shipping",
        tax: "VAT",
        total: "Total",
        shippingAddress: "Shipping Address",
        paymentMethod: "Payment Method",
        estimatedDelivery: "Estimated delivery: {days} business days",
        questions: "If you have any questions, please contact us",
        footer: "UNBREAK ONE - Magnetic Holders for Glasses & Bottles",
        unsubscribe: "Unsubscribe",
        privacy: "Privacy Policy",
        imprint: "Imprint",
        configured: "Configured",
        viewOrder: "View Order"
      },
      admin: {
        subject: "New Order - {orderNumber}",
        newOrder: "New order received",
        orderDetails: "Order Details",
        customerInfo: "Customer Information",
        customerName: "Name",
        customerEmail: "Email",
        orderNumber: "Order Number",
        orderDate: "Order Date",
        items: "Items",
        shippingAddress: "Shipping Address",
        total: "Total",
        viewInAdmin: "View in Admin Panel",
        configured: "Configured - Details in Admin Panel"
      }
    },
    messages: {
      addToCart: "Item added to cart",
      cartAddFailed: "Could not add item to cart",
      cartLoadFailed: "Could not load cart",
      configLoadFailed: "Could not load configuration",
      checkoutSuccess: "Order successful!",
      checkoutFailed: "Order failed. Please try again.",
      sessionExpired: "Session expired. Please reload the page.",
      networkError: "Network error. Please check your internet connection."
    },
    success: {
      loading: {
        title: "Processing Order",
        message: "Processing your order..."
      },
      error: {
        title: "Error",
        heading: "Error Processing Order",
        backToShop: "Back to Shop"
      },
      success: {
        title: "Order Successful",
        heading: "Order Successful!",
        message: "Thank you for your order. We have sent a confirmation email to your provided address."
      },
      orderInfo: {
        orderNumber: "Order Number:",
        totalAmount: "Total Amount:"
      },
      nextSteps: {
        title: "What happens next?",
        step1: "You will receive a confirmation email with all details",
        step2: "Your UNBREAK ONE will be individually crafted for you",
        step3: "Shipping within 3-5 business days",
        step4: "You will receive a tracking number via email"
      },
      actions: {
        toHome: "Go to Homepage",
        continueShopping: "Continue Shopping"
      },
      support: {
        question: "Questions about your order?",
        contactUs: "Contact us"
      }
    }
  }
};

/**
 * Get translated string with parameter substitution
 * @param {string} lang - Language code (de/en)
 * @param {string} key - Translation key (e.g., 'cart.title')
 * @param {object} params - Parameters for substitution (e.g., {count: 5})
 */
export function t(lang, key, params = {}) {
  const keys = key.split('.');
  let value = shopTranslations[lang] || shopTranslations.de;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }
  
  // Fallback to German
  if (value === undefined) {
    let fallback = shopTranslations.de;
    for (const k of keys) {
      fallback = fallback?.[k];
      if (fallback === undefined) break;
    }
    value = fallback || key;
  }
  
  // Parameter substitution
  if (typeof value === 'string' && params) {
    Object.keys(params).forEach(param => {
      value = value.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });
  }
  
  return value || key;
}

/**
 * Get current language from i18n system
 */
export function getCurrentLanguage() {
  if (typeof window !== 'undefined') {
    // Check window.i18n first
    if (window.i18n && typeof window.i18n.getCurrentLanguage === 'function') {
      return window.i18n.getCurrentLanguage();
    }
    
    // Check localStorage
    const stored = localStorage.getItem('unbreakone_lang');
    if (stored && ['de', 'en'].includes(stored)) {
      return stored;
    }
    
    // Check HTML lang attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang && ['de', 'en'].includes(htmlLang)) {
      return htmlLang;
    }
  }
  
  return 'de'; // Fallback
}

/**
 * Helper: Get translation with auto-detected language
 */
export function ts(key, params) {
  const lang = getCurrentLanguage();
  return t(lang, key, params);
}
