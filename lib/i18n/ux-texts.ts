/**
 * UX Texts - Configurator Design
 * 
 * Customer-facing text strings for cart, checkout, and order confirmation.
 * 
 * Rules:
 * - No internal SKUs or technical keys
 * - Clear, calm, premium tone
 * - German language (primary market)
 */

export const UX_TEXTS = {
  
  /**
   * Product Title Format
   * Used in: Cart, Checkout, Order Confirmation, Invoice
   */
  productTitle: {
    /**
     * Template: "{baseProductName} – individuelles Design"
     * @param baseProductName - Human-readable base product name
     */
    template: (baseProductName: string) => `${baseProductName} – individuelles Design`,
    
    examples: [
      'Glashalter – individuelles Design',
      'Flaschenhalter – individuelles Design',
      'Weinglas-Halter – individuelles Design'
    ]
  },
  
  /**
   * Short Description
   * Used in: Cart, Product Details
   */
  shortDescription: {
    default: 'Individuell konfiguriertes Produkt nach Ihren Wünschen gefertigt.',
    withCustomization: 'Dieses Produkt wird speziell nach Ihrer Konfiguration angefertigt.'
  },
  
  /**
   * Price Breakdown Labels
   * Used in: Cart (expandable), Checkout
   */
  priceBreakdown: {
    header: 'Preisaufschlüsselung',
    baseProduct: 'Basisprodukt',
    customization: 'Individualisierung',
    premiumComponents: 'Optionale Komponenten',
    
    // Individual addon labels (customer-facing)
    addons: {
      woodBase: 'Holzsockel',
      metalRing: 'Metallring',
      customColorRAL: 'Wunschfarbe (RAL)',
      customColorHex: 'Individuelle Farbe',
      engraving: 'Gravur',
      engravingLogo: 'Logo-Gravur',
      giftBox: 'Geschenkbox',
      premiumPackaging: 'Premium-Verpackung'
    },
    
    total: 'Gesamt',
    subtotal: 'Zwischensumme',
    vat: 'inkl. MwSt.',
    shipping: 'zzgl. Versand'
  },
  
  /**
   * Confirmation & Info Messages
   * Used in: Checkout, Order Confirmation
   */
  confirmation: {
    checkout: 'Dieses Produkt wird individuell nach Ihrer Konfiguration gefertigt.',
    orderConfirmation: 'Ihre individuelle Konfiguration wurde erfolgreich übermittelt.',
    productionTime: 'Voraussichtliche Produktionszeit: 5-7 Werktage',
    customizationNotice: 'Individualisierte Produkte sind vom Umtausch ausgeschlossen.'
  },
  
  /**
   * Cart Actions
   * Used in: Cart UI
   */
  actions: {
    addToCart: 'In den Warenkorb',
    updateDesign: 'Design aktualisieren',
    duplicateDesign: 'Design duplizieren',
    removeFromCart: 'Entfernen',
    viewDetails: 'Details anzeigen',
    editDesign: 'Design bearbeiten'
  },
  
  /**
   * Error Messages
   * Used in: Validation, Checkout
   */
  errors: {
    priceMismatch: 'Der Preis wurde aktualisiert. Bitte überprüfen Sie Ihre Bestellung.',
    invalidConfiguration: 'Die Konfiguration ist ungültig. Bitte versuchen Sie es erneut.',
    productNotAvailable: 'Dieses Produkt ist derzeit nicht verfügbar.',
    customizationFeeRequired: 'Für individualisierte Produkte fällt eine Bearbeitungsgebühr an.',
    addonNotAvailable: 'Eine ausgewählte Komponente ist nicht mehr verfügbar.'
  },
  
  /**
   * Invoice Line Item Format
   * Used in: Invoice generation
   */
  invoice: {
    /**
     * Main line item title
     * Format: "{baseProductName} – individuelles Design"
     */
    lineItemTitle: (baseProductName: string) => `${baseProductName} – individuelles Design`,
    
    /**
     * Optional breakdown (indented, non-tax-relevant)
     */
    breakdown: {
      prefix: 'inkl.',
      baseProduct: 'inkl. Basisprodukt',
      customization: 'inkl. Individualisierung',
      components: 'inkl. Sonderkomponenten'
    },
    
    /**
     * Footer notes
     */
    notes: {
      customProduct: 'Individuell gefertigtes Produkt',
      productionTime: 'Produktionszeit: 5-7 Werktage ab Zahlungseingang',
      noReturn: 'Individualisierte Produkte sind vom Widerrufsrecht ausgeschlossen (§ 312g Abs. 2 Nr. 1 BGB)'
    }
  },
  
  /**
   * Order Confirmation Email
   * Used in: Email templates
   */
  email: {
    subject: 'Bestellbestätigung – Individuelles Design',
    greeting: (customerName: string) => `Hallo ${customerName},`,
    intro: 'vielen Dank für Ihre Bestellung bei Unbreak One.',
    customProductNotice: 'Ihr individuell konfiguriertes Produkt wird nun speziell für Sie gefertigt.',
    
    orderDetails: {
      header: 'Ihre Bestellung',
      orderNumber: 'Bestellnummer',
      orderDate: 'Bestelldatum',
      productionEstimate: 'Voraussichtliche Fertigstellung'
    },
    
    closing: 'Mit freundlichen Grüßen\nIhr Unbreak One Team'
  }
} as const;

/**
 * Get product title for display
 */
export function getProductTitle(baseProductName: string): string {
  return UX_TEXTS.productTitle.template(baseProductName);
}

/**
 * Get invoice line item title
 */
export function getInvoiceLineTitle(baseProductName: string): string {
  return UX_TEXTS.invoice.lineItemTitle(baseProductName);
}

/**
 * Get addon label (customer-facing)
 */
export function getAddonLabel(addonKey: string): string {
  const labelMap: Record<string, string> = {
    ADDON_WOOD_INLAY: UX_TEXTS.priceBreakdown.addons.woodBase,
    ADDON_METAL_RING: UX_TEXTS.priceBreakdown.addons.metalRing,
    ADDON_CUSTOM_COLOR_RAL: UX_TEXTS.priceBreakdown.addons.customColorRAL,
    ADDON_CUSTOM_COLOR_HEX: UX_TEXTS.priceBreakdown.addons.customColorHex,
    ADDON_ENGRAVING_STANDARD: UX_TEXTS.priceBreakdown.addons.engraving,
    ADDON_ENGRAVING_LOGO: UX_TEXTS.priceBreakdown.addons.engravingLogo,
    ADDON_GIFT_BOX: UX_TEXTS.priceBreakdown.addons.giftBox,
    ADDON_PREMIUM_PACKAGING: UX_TEXTS.priceBreakdown.addons.premiumPackaging
  };
  
  return labelMap[addonKey] || addonKey;
}

/**
 * Export type definitions
 */
export type UXTexts = typeof UX_TEXTS;
