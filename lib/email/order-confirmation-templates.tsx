/**
 * Order Confirmation Templates
 * 
 * Email and page templates for custom product orders
 * Includes legal notices and production information
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import { LEGAL_TEXTS } from '@/lib/legal/legal-texts';
import { UX_TEXTS } from '@/lib/i18n/ux-texts';

/**
 * Order Confirmation Data
 */
export interface OrderConfirmationData {
  orderNumber: string;
  orderDate: string;
  customer: {
    name: string;
    email: string;
  };
  lineItems: Array<{
    title: string;
    quantity: number;
    priceGross: number;
    isCustomProduct: boolean;
  }>;
  total: number;
  currency: string;
  estimatedProductionDate?: string;
  trackingUrl?: string;
}

/**
 * Generate Order Confirmation Email (HTML)
 */
export function generateOrderConfirmationEmail(
  data: OrderConfirmationData
): {
  subject: string;
  html: string;
  text: string;
} {
  const hasCustomProducts = data.lineItems.some(item => item.isCustomProduct);

  const subject = hasCustomProducts
    ? LEGAL_TEXTS.orderConfirmation.emailSubject
    : 'Bestellbestätigung';

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <!-- Header -->
  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #ddd;">
    <h1 style="margin: 0; color: #1976d2;">Unbreak</h1>
    <p style="margin: 5px 0 0 0; color: #666;">Bestellbestätigung</p>
  </div>

  <!-- Greeting -->
  <div style="padding: 30px 0 20px 0;">
    <p style="margin: 0 0 10px 0;">Hallo ${data.customer.name},</p>
    <p style="margin: 0;">vielen Dank für Ihre Bestellung!</p>
  </div>

  ${hasCustomProducts ? `
  <!-- Custom Product Notice -->
  <div style="background: #e3f2fd; border-left: 4px solid #1976d2; padding: 16px; margin: 20px 0; border-radius: 4px;">
    <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #1976d2;">
      ${LEGAL_TEXTS.orderConfirmation.headline}
    </h2>
    <p style="margin: 0; font-size: 14px; color: #555;">
      ${LEGAL_TEXTS.orderConfirmation.bodyText}
    </p>
    ${data.estimatedProductionDate ? `
    <p style="margin: 10px 0 0 0; font-size: 14px; color: #555;">
      <strong>Voraussichtliche Fertigstellung:</strong> ${data.estimatedProductionDate}
    </p>
    ` : ''}
  </div>
  ` : ''}

  <!-- Order Details -->
  <div style="margin: 30px 0;">
    <h2 style="font-size: 18px; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
      Bestelldetails
    </h2>
    
    <table style="width: 100%; margin-bottom: 10px;">
      <tr>
        <td style="padding: 5px 0; color: #666;">Bestellnummer:</td>
        <td style="padding: 5px 0; text-align: right; font-weight: bold;">${data.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; color: #666;">Bestelldatum:</td>
        <td style="padding: 5px 0; text-align: right;">${data.orderDate}</td>
      </tr>
    </table>
  </div>

  <!-- Line Items -->
  <div style="margin: 30px 0;">
    <h2 style="font-size: 18px; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
      Bestellte Artikel
    </h2>
    
    ${data.lineItems.map(item => `
    <div style="padding: 15px 0; border-bottom: 1px solid #eee;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <strong style="font-size: 15px;">${item.title}</strong>
          ${item.isCustomProduct ? `
          <div style="margin-top: 5px;">
            <span style="display: inline-block; background: #e3f2fd; color: #1976d2; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
              ${LEGAL_TEXTS.cartItemNotice.badge}
            </span>
          </div>
          ` : ''}
          <p style="margin: 5px 0 0 0; color: #666; font-size: 13px;">Menge: ${item.quantity}</p>
        </div>
        <div style="text-align: right; font-size: 16px; font-weight: bold;">
          ${item.priceGross.toFixed(2)} €
        </div>
      </div>
    </div>
    `).join('')}
    
    <!-- Total -->
    <div style="padding: 20px 0; text-align: right; font-size: 18px;">
      <strong>Gesamtbetrag: ${data.total.toFixed(2)} €</strong>
    </div>
  </div>

  ${hasCustomProducts ? `
  <!-- Legal Notice -->
  <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 16px; margin: 30px 0; border-radius: 4px;">
    <p style="margin: 0 0 10px 0; font-size: 14px; color: #856404; font-weight: bold;">
      Hinweis zu individualisierten Produkten
    </p>
    <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.6;">
      Da es sich um ein individuell nach Ihren Vorgaben gefertigtes Produkt handelt, ist ein Widerruf gemäß §312g Abs. 2 Nr. 1 BGB ausgeschlossen.
    </p>
    <p style="margin: 10px 0 0 0; font-size: 13px; color: #856404;">
      Produktionszeit: 5-7 Werktage<br>
      Status-Updates erhalten Sie per E-Mail.
    </p>
  </div>
  ` : ''}

  <!-- Next Steps -->
  <div style="margin: 30px 0;">
    <h2 style="font-size: 18px; margin: 0 0 15px 0;">Wie geht es weiter?</h2>
    <ol style="margin: 0; padding-left: 20px; color: #555;">
      ${hasCustomProducts ? `
      <li style="margin-bottom: 10px;">Die Herstellung beginnt nach Zahlungseingang</li>
      <li style="margin-bottom: 10px;">Sie erhalten regelmäßige Status-Updates per E-Mail</li>
      <li style="margin-bottom: 10px;">Nach Fertigstellung wird Ihr Produkt versendet (5-7 Werktage)</li>
      <li style="margin-bottom: 10px;">Sie erhalten eine Tracking-Nummer für den Versand</li>
      ` : `
      <li style="margin-bottom: 10px;">Wir bereiten Ihre Bestellung vor</li>
      <li style="margin-bottom: 10px;">Sie erhalten eine Versandbestätigung mit Tracking-Nummer</li>
      <li style="margin-bottom: 10px;">Lieferzeit: 2-3 Werktage</li>
      `}
    </ol>
  </div>

  <!-- Support -->
  <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 4px;">
    <p style="margin: 0 0 10px 0; font-weight: bold;">Fragen zu Ihrer Bestellung?</p>
    <p style="margin: 0; font-size: 14px; color: #666;">
      Unser Kundenservice hilft Ihnen gerne weiter:<br>
      E-Mail: <a href="mailto:info@unbreak.one" style="color: #1976d2;">info@unbreak.one</a><br>
      Mo-Fr, 9:00-18:00 Uhr
    </p>
  </div>

  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #999; font-size: 12px;">
    <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Unbreak GmbH</p>
    <p style="margin: 0;">
      <a href="/agb" style="color: #999; text-decoration: none;">AGB</a> · 
      <a href="/datenschutz" style="color: #999; text-decoration: none;">Datenschutz</a> · 
      <a href="/impressum" style="color: #999; text-decoration: none;">Impressum</a>
    </p>
  </div>

</body>
</html>
  `.trim();

  // Plain text version
  const text = `
BESTELLBESTÄTIGUNG
──────────────────────────────────────────

Hallo ${data.customer.name},

vielen Dank für Ihre Bestellung!

${hasCustomProducts ? `
${LEGAL_TEXTS.orderConfirmation.headline}
${LEGAL_TEXTS.orderConfirmation.bodyText}
${data.estimatedProductionDate ? `Voraussichtliche Fertigstellung: ${data.estimatedProductionDate}` : ''}
` : ''}

BESTELLDETAILS
──────────────────────────────────────────
Bestellnummer: ${data.orderNumber}
Bestelldatum: ${data.orderDate}

BESTELLTE ARTIKEL
──────────────────────────────────────────
${data.lineItems.map(item => `
${item.title} ${item.isCustomProduct ? '(Individuelles Produkt)' : ''}
Menge: ${item.quantity}
Preis: ${item.priceGross.toFixed(2)} €
`).join('\n')}

Gesamtbetrag: ${data.total.toFixed(2)} €

${hasCustomProducts ? `
HINWEIS ZU INDIVIDUALISIERTEN PRODUKTEN
──────────────────────────────────────────
Da es sich um ein individuell nach Ihren Vorgaben gefertigtes Produkt handelt, ist ein Widerruf gemäß §312g Abs. 2 Nr. 1 BGB ausgeschlossen.

Produktionszeit: 5-7 Werktage
Status-Updates erhalten Sie per E-Mail.
` : ''}

FRAGEN ZU IHRER BESTELLUNG?
──────────────────────────────────────────
Unser Kundenservice hilft Ihnen gerne weiter:
E-Mail: info@unbreak.one
Mo-Fr, 9:00-18:00 Uhr

──────────────────────────────────────────
© ${new Date().getFullYear()} Unbreak GmbH
  `.trim();

  return { subject, html, text };
}

/**
 * Generate Order Confirmation Page (React Component)
 */
export const OrderConfirmationPage = `
import React from 'react';
import { LEGAL_TEXTS } from '@/lib/legal/legal-texts';

export default function OrderConfirmationPage({ order }) {
  const hasCustomProducts = order.lineItems.some(item => item.isCustomProduct);

  return (
    <div className="order-confirmation-page">
      <div className="confirmation-header">
        <div className="success-icon">✓</div>
        <h1>Bestellung erfolgreich!</h1>
        <p className="subtitle">Vielen Dank für Ihre Bestellung</p>
      </div>

      {hasCustomProducts && (
        <div className="custom-product-notice">
          <h2>{LEGAL_TEXTS.orderConfirmation.headline}</h2>
          <p>{LEGAL_TEXTS.orderConfirmation.bodyText}</p>
          {order.estimatedProductionDate && (
            <p className="production-date">
              <strong>Voraussichtliche Fertigstellung:</strong> {order.estimatedProductionDate}
            </p>
          )}
        </div>
      )}

      <div className="order-details">
        <h2>Bestelldetails</h2>
        <dl>
          <dt>Bestellnummer:</dt>
          <dd>{order.orderNumber}</dd>
          <dt>Bestelldatum:</dt>
          <dd>{order.orderDate}</dd>
        </dl>
      </div>

      <div className="order-items">
        <h2>Bestellte Artikel</h2>
        {order.lineItems.map((item, idx) => (
          <div key={idx} className="order-item">
            <div className="item-info">
              <h3>{item.title}</h3>
              {item.isCustomProduct && (
                <span className="custom-badge">{LEGAL_TEXTS.cartItemNotice.badge}</span>
              )}
              <p>Menge: {item.quantity}</p>
            </div>
            <div className="item-price">{item.priceGross.toFixed(2)} €</div>
          </div>
        ))}
        <div className="order-total">
          <strong>Gesamtbetrag: {order.total.toFixed(2)} €</strong>
        </div>
      </div>

      {hasCustomProducts && (
        <div className="legal-notice">
          <p className="notice-title">Hinweis zu individualisierten Produkten</p>
          <p>
            Da es sich um ein individuell nach Ihren Vorgaben gefertigtes Produkt handelt,
            ist ein Widerruf gemäß §312g Abs. 2 Nr. 1 BGB ausgeschlossen.
          </p>
        </div>
      )}

      <div className="next-steps">
        <h2>Wie geht es weiter?</h2>
        <ol>
          {hasCustomProducts ? (
            <>
              <li>Die Herstellung beginnt nach Zahlungseingang</li>
              <li>Sie erhalten regelmäßige Status-Updates per E-Mail</li>
              <li>Nach Fertigstellung wird Ihr Produkt versendet (5-7 Werktage)</li>
              <li>Sie erhalten eine Tracking-Nummer für den Versand</li>
            </>
          ) : (
            <>
              <li>Wir bereiten Ihre Bestellung vor</li>
              <li>Sie erhalten eine Versandbestätigung mit Tracking-Nummer</li>
              <li>Lieferzeit: 2-3 Werktage</li>
            </>
          )}
        </ol>
      </div>
    </div>
  );
}
`;

/**
 * Example Usage:
 * 
 * ```tsx
 * import { generateOrderConfirmationEmail } from '@/lib/email/order-confirmation';
 * 
 * // After order creation
 * const emailData = generateOrderConfirmationEmail({
 *   orderNumber: 'ORD-2026-001234',
 *   orderDate: '03.01.2026',
 *   customer: { name: 'Max Mustermann', email: 'max@example.com' },
 *   lineItems: [...],
 *   total: 180.88,
 *   currency: 'EUR',
 *   estimatedProductionDate: '10.01.2026'
 * });
 * 
 * await sendEmail({
 *   to: customer.email,
 *   subject: emailData.subject,
 *   html: emailData.html,
 *   text: emailData.text
 * });
 * ```
 */
