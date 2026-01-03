/**
 * Legal Texts Configuration (Phase 4)
 * 
 * EU/German legal compliance for custom-made products
 * §312g Abs. 2 Nr. 1 BGB - Withdrawal exclusion for custom products
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

export const LEGAL_TEXTS = {
  /**
   * Checkout Confirmation (MANDATORY)
   * Required checkbox before purchase completion
   */
  checkoutConfirmation: {
    checkboxLabel: 'Ich bestätige, dass dieses Produkt individuell nach meinen Vorgaben gefertigt wird und vom Widerrufsrecht ausgeschlossen ist.',
    
    // Optional expandable explanation
    expandableText: `
Dieses Produkt wird speziell nach Ihren persönlichen Vorgaben hergestellt und ist daher gemäß §312g Abs. 2 Nr. 1 BGB vom Widerrufsrecht ausgeschlossen.

Nach Ihrer Bestellung beginnen wir mit der individuellen Fertigung. Ein Widerruf ist daher nicht möglich.
    `.trim(),
    
    // Error message if checkbox not checked
    validationError: 'Bitte bestätigen Sie, dass Sie die Bedingungen für individuell gefertigte Produkte verstanden haben.',
    
    // Accessibility label
    ariaLabel: 'Bestätigung: Individuell gefertigtes Produkt, vom Widerrufsrecht ausgeschlossen'
  },

  /**
   * Product Page Legal Notice
   * Displayed before add-to-cart on configurator products
   */
  productPageNotice: {
    short: 'Hinweis: Dieses Produkt wird individuell für Sie gefertigt und ist vom Widerrufsrecht ausgeschlossen.',
    
    extended: 'Dieses Produkt wird nach Ihrer individuellen Konfiguration gefertigt und ist gemäß §312g Abs. 2 Nr. 1 BGB vom Widerrufsrecht ausgeschlossen.',
    
    // Icon/styling hint
    iconType: 'info', // 'info', 'warning', or 'legal'
    
    // Link to full terms
    linkText: 'Mehr Informationen zu individuell gefertigten Produkten',
    linkTarget: '/agb#custom-products'
  },

  /**
   * Cart Item Notice
   * Shown in cart for configurator items
   */
  cartItemNotice: {
    badge: 'Individuelles Produkt',
    tooltip: 'Dieses Produkt wird nach Ihren Vorgaben gefertigt und ist vom Widerrufsrecht ausgeschlossen.',
    description: 'Individuell nach Ihrer Konfiguration gefertigt'
  },

  /**
   * Order Confirmation (Email + Order Success Page)
   */
  orderConfirmation: {
    headline: 'Sie haben ein individuell gefertigtes Produkt bestellt.',
    
    bodyText: 'Die Herstellung beginnt nach Zahlungseingang.',
    
    fullText: `
Sie haben ein individuell gefertigtes Produkt bestellt. Die Herstellung beginnt nach Zahlungseingang.

Produktionszeit: 5-7 Werktage
Status-Updates erhalten Sie per E-Mail.

Da es sich um ein individuell nach Ihren Vorgaben gefertigtes Produkt handelt, ist ein Widerruf gemäß §312g Abs. 2 Nr. 1 BGB ausgeschlossen.
    `.trim(),
    
    // Email subject line
    emailSubject: 'Bestellbestätigung – Individuelles Produkt',
    
    // Email body snippet
    emailBodySnippet: 'Ihre Bestellung für ein individuell gefertigtes Produkt wurde erfolgreich übermittelt. Die Herstellung beginnt nach Zahlungseingang.'
  },

  /**
   * AGB Section - Custom Products
   * Content for terms of service
   */
  agb: {
    sectionTitle: 'Individuell gefertigte Produkte',
    
    sectionSlug: 'custom-products',
    
    content: `
## Individuell gefertigte Produkte

Produkte, die nach Kundenspezifikation angefertigt werden oder eindeutig auf persönliche Bedürfnisse zugeschnitten sind, sind gemäß §312g Abs. 2 Nr. 1 BGB vom Widerrufsrecht ausgeschlossen.

### Was bedeutet das?

Wenn Sie ein Produkt über unseren Konfigurator individuell gestalten, wird dieses Produkt speziell für Sie angefertigt. Aufgrund der individuellen Anfertigung können wir das Produkt nicht an andere Kunden verkaufen.

### Ausschluss des Widerrufsrechts

Für individuell gefertigte Produkte besteht kein Widerrufsrecht. Mit Ihrer Bestellung erklären Sie sich ausdrücklich damit einverstanden, dass die Herstellung nach Zahlungseingang beginnt.

### Bestätigung im Bestellprozess

Vor Abschluss Ihrer Bestellung werden Sie ausdrücklich auf den Ausschluss des Widerrufsrechts hingewiesen und müssen dies bestätigen.

### Produktionsablauf

1. Sie schließen die Bestellung ab
2. Nach Zahlungseingang beginnt die Fertigung
3. Produktionszeit: 5-7 Werktage
4. Versand und Lieferung

### Ihre Rechte

Das Ausschluss des Widerrufsrechts betrifft nur die individuelle Gestaltung. Gesetzliche Gewährleistungsrechte bei Mängeln bleiben unberührt.
    `.trim(),
    
    // Short version for footer links
    shortContent: 'Produkte, die nach Kundenspezifikation angefertigt werden oder eindeutig auf persönliche Bedürfnisse zugeschnitten sind, sind gemäß §312g Abs. 2 Nr. 1 BGB vom Widerrufsrecht ausgeschlossen.',
    
    // Legal reference
    legalReference: '§312g Abs. 2 Nr. 1 BGB'
  },

  /**
   * Admin/Internal Labels
   * Not customer-facing
   */
  internal: {
    orderFlagLabel: 'Individuell gefertigt',
    withdrawalExcludedLabel: 'Widerruf ausgeschlossen',
    consentRecordedLabel: 'Bestätigung erfasst',
    
    adminNote: 'Kunde hat Ausschluss des Widerrufsrechts bestätigt',
    
    exportLabel: 'Custom Product (Withdrawal Excluded)'
  }
} as const;

/**
 * Legal Consent Data Schema
 * Fields to store with each order
 */
export interface LegalConsentData {
  /**
   * Product type flag
   */
  isCustomProduct: boolean;

  /**
   * Withdrawal right excluded flag
   */
  withdrawalExcluded: boolean;

  /**
   * Timestamp of customer confirmation (ISO 8601)
   */
  customizationConfirmedAt: string;

  /**
   * IP address of confirmation (for legal documentation)
   * IPv4 or IPv6 format
   */
  customizationConfirmationIP: string;

  /**
   * User agent string (optional, for fraud prevention)
   */
  confirmationUserAgent?: string;

  /**
   * Legal text version shown to customer
   */
  legalTextVersion: string;

  /**
   * Checkbox state (must be true)
   */
  checkboxConfirmed: boolean;

  /**
   * Optional: Session ID for audit trail
   */
  sessionId?: string;
}

/**
 * Validation: Check if legal consent is valid
 */
export function validateLegalConsent(consent: LegalConsentData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!consent.isCustomProduct) {
    errors.push('isCustomProduct must be true for configurator orders');
  }

  if (!consent.withdrawalExcluded) {
    errors.push('withdrawalExcluded must be true for custom products');
  }

  if (!consent.checkboxConfirmed) {
    errors.push('Customer must confirm checkbox');
  }

  if (!consent.customizationConfirmedAt) {
    errors.push('Confirmation timestamp required');
  } else {
    // Validate ISO 8601 timestamp
    const date = new Date(consent.customizationConfirmedAt);
    if (isNaN(date.getTime())) {
      errors.push('Invalid timestamp format');
    }
  }

  if (!consent.customizationConfirmationIP) {
    errors.push('Confirmation IP address required');
  } else {
    // Basic IP validation (IPv4 or IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    
    if (!ipv4Regex.test(consent.customizationConfirmationIP) && 
        !ipv6Regex.test(consent.customizationConfirmationIP)) {
      errors.push('Invalid IP address format');
    }
  }

  if (!consent.legalTextVersion) {
    errors.push('Legal text version required for audit trail');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create legal consent record
 * Call this when checkout confirmation is submitted
 */
export function createLegalConsentRecord(
  customerIP: string,
  userAgent?: string,
  sessionId?: string
): LegalConsentData {
  return {
    isCustomProduct: true,
    withdrawalExcluded: true,
    customizationConfirmedAt: new Date().toISOString(),
    customizationConfirmationIP: customerIP,
    confirmationUserAgent: userAgent,
    legalTextVersion: '1.0.0', // Match LEGAL_TEXTS version
    checkboxConfirmed: true,
    sessionId
  };
}

/**
 * Export consent data for legal documentation
 */
export function exportLegalConsentForAudit(
  orderId: string,
  consent: LegalConsentData
): string {
  return `
LEGAL CONSENT RECORD
────────────────────────────────────────
Order ID: ${orderId}
Product Type: Custom-made product (§312g Abs. 2 Nr. 1 BGB)
Withdrawal Right: Excluded

Customer Confirmation:
  Timestamp: ${consent.customizationConfirmedAt}
  IP Address: ${consent.customizationConfirmationIP}
  User Agent: ${consent.confirmationUserAgent || 'N/A'}
  Session ID: ${consent.sessionId || 'N/A'}
  Legal Text Version: ${consent.legalTextVersion}
  Checkbox Confirmed: ${consent.checkboxConfirmed ? 'YES' : 'NO'}

Legal Text Shown:
"${LEGAL_TEXTS.checkoutConfirmation.checkboxLabel}"

────────────────────────────────────────
Generated: ${new Date().toISOString()}
  `.trim();
}

/**
 * Type exports
 */
export type LegalTexts = typeof LEGAL_TEXTS;
export type CheckoutConfirmationTexts = typeof LEGAL_TEXTS.checkoutConfirmation;
export type ProductPageNoticeTexts = typeof LEGAL_TEXTS.productPageNotice;
export type AGBTexts = typeof LEGAL_TEXTS.agb;
