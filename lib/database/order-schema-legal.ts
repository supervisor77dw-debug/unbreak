/**
 * Order Schema with Legal Consent Fields
 * 
 * Database schema extension for custom product legal compliance
 * Prisma schema updates required for persistence
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import { LegalConsentData } from '@/lib/legal/legal-texts';

/**
 * Extended Order Interface
 * Includes legal consent fields for custom products
 */
export interface OrderWithLegalConsent {
  // Standard order fields
  orderId: string;
  orderNumber: string;
  customerId: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;

  // Line items
  lineItems: OrderLineItem[];

  // Customer data
  customer: {
    name: string;
    email: string;
    address: {
      street: string;
      postalCode: string;
      city: string;
      country: string;
    };
  };

  // LEGAL CONSENT FIELDS (Phase 4)
  legalConsent: LegalConsentData;
}

export interface OrderLineItem {
  lineItemId: string;
  type: 'CONFIGURATOR_DESIGN' | 'STANDARD_PRODUCT';
  title: string;
  quantity: number;
  pricing: {
    totalNet: number;
    totalGross: number;
    currency: string;
  };

  // Configurator-specific fields
  designId?: string;
  payload?: any;

  // Legal flags (per line item)
  isCustomProduct?: boolean;
  withdrawalExcluded?: boolean;
}

/**
 * Prisma Schema Extension
 * Add these fields to your Order model:
 * 
 * ```prisma
 * model Order {
 *   id        String   @id @default(cuid())
 *   orderNumber String @unique
 *   
 *   // ... existing fields ...
 *   
 *   // Legal Consent Fields (Phase 4)
 *   isCustomProduct              Boolean  @default(false)
 *   withdrawalExcluded           Boolean  @default(false)
 *   customizationConfirmedAt     DateTime?
 *   customizationConfirmationIP  String?
 *   confirmationUserAgent        String?
 *   legalTextVersion             String?
 *   checkboxConfirmed            Boolean  @default(false)
 *   sessionId                    String?
 *   
 *   @@index([isCustomProduct])
 *   @@index([withdrawalExcluded])
 * }
 * ```
 */

/**
 * Database Migration SQL (PostgreSQL)
 * 
 * ```sql
 * -- Add legal consent columns to orders table
 * ALTER TABLE "Order" 
 *   ADD COLUMN "isCustomProduct" BOOLEAN NOT NULL DEFAULT false,
 *   ADD COLUMN "withdrawalExcluded" BOOLEAN NOT NULL DEFAULT false,
 *   ADD COLUMN "customizationConfirmedAt" TIMESTAMP(3),
 *   ADD COLUMN "customizationConfirmationIP" VARCHAR(45),
 *   ADD COLUMN "confirmationUserAgent" TEXT,
 *   ADD COLUMN "legalTextVersion" VARCHAR(20),
 *   ADD COLUMN "checkboxConfirmed" BOOLEAN NOT NULL DEFAULT false,
 *   ADD COLUMN "sessionId" VARCHAR(255);
 * 
 * -- Create indexes for reporting
 * CREATE INDEX "Order_isCustomProduct_idx" ON "Order"("isCustomProduct");
 * CREATE INDEX "Order_withdrawalExcluded_idx" ON "Order"("withdrawalExcluded");
 * CREATE INDEX "Order_customizationConfirmedAt_idx" ON "Order"("customizationConfirmedAt");
 * 
 * -- Create audit table for legal compliance
 * CREATE TABLE "LegalConsentAudit" (
 *   "id" TEXT NOT NULL,
 *   "orderId" TEXT NOT NULL,
 *   "confirmedAt" TIMESTAMP(3) NOT NULL,
 *   "ipAddress" VARCHAR(45) NOT NULL,
 *   "userAgent" TEXT,
 *   "legalTextVersion" VARCHAR(20) NOT NULL,
 *   "checkboxText" TEXT NOT NULL,
 *   "sessionId" VARCHAR(255),
 *   "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   
 *   CONSTRAINT "LegalConsentAudit_pkey" PRIMARY KEY ("id"),
 *   CONSTRAINT "LegalConsentAudit_orderId_fkey" FOREIGN KEY ("orderId") 
 *     REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
 * );
 * 
 * CREATE INDEX "LegalConsentAudit_orderId_idx" ON "LegalConsentAudit"("orderId");
 * CREATE INDEX "LegalConsentAudit_confirmedAt_idx" ON "LegalConsentAudit"("confirmedAt");
 * ```
 */

/**
 * Create Order with Legal Consent
 * Server-side function to persist order with legal data
 */
export async function createOrderWithLegalConsent(
  orderData: Omit<OrderWithLegalConsent, 'orderId' | 'createdAt'>,
  legalConsent: LegalConsentData
): Promise<OrderWithLegalConsent> {
  // Validate legal consent
  const { valid, errors } = validateLegalConsent(legalConsent);
  
  if (!valid) {
    throw new Error(`Legal consent validation failed: ${errors.join(', ')}`);
  }

  // In production, use Prisma:
  // const order = await prisma.order.create({
  //   data: {
  //     ...orderData,
  //     isCustomProduct: legalConsent.isCustomProduct,
  //     withdrawalExcluded: legalConsent.withdrawalExcluded,
  //     customizationConfirmedAt: new Date(legalConsent.customizationConfirmedAt),
  //     customizationConfirmationIP: legalConsent.customizationConfirmationIP,
  //     confirmationUserAgent: legalConsent.confirmationUserAgent,
  //     legalTextVersion: legalConsent.legalTextVersion,
  //     checkboxConfirmed: legalConsent.checkboxConfirmed,
  //     sessionId: legalConsent.sessionId
  //   }
  // });

  // Also create audit record:
  // await prisma.legalConsentAudit.create({
  //   data: {
  //     orderId: order.id,
  //     confirmedAt: new Date(legalConsent.customizationConfirmedAt),
  //     ipAddress: legalConsent.customizationConfirmationIP,
  //     userAgent: legalConsent.confirmationUserAgent || '',
  //     legalTextVersion: legalConsent.legalTextVersion,
  //     checkboxText: LEGAL_TEXTS.checkoutConfirmation.checkboxLabel,
  //     sessionId: legalConsent.sessionId
  //   }
  // });

  // Placeholder return
  return {
    ...orderData,
    orderId: `ord_${Date.now()}`,
    createdAt: new Date().toISOString(),
    legalConsent
  };
}

/**
 * Query Orders with Legal Consent
 * For admin panel / reporting
 */
export async function getOrdersWithLegalConsent(filters?: {
  isCustomProduct?: boolean;
  withdrawalExcluded?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<OrderWithLegalConsent[]> {
  // In production:
  // return await prisma.order.findMany({
  //   where: {
  //     isCustomProduct: filters?.isCustomProduct,
  //     withdrawalExcluded: filters?.withdrawalExcluded,
  //     customizationConfirmedAt: {
  //       gte: filters?.dateFrom,
  //       lte: filters?.dateTo
  //     }
  //   },
  //   orderBy: { createdAt: 'desc' }
  // });

  return [];
}

/**
 * Get Legal Consent Audit Trail
 * For legal documentation/disputes
 */
export async function getLegalConsentAudit(orderId: string) {
  // In production:
  // return await prisma.legalConsentAudit.findFirst({
  //   where: { orderId },
  //   include: {
  //     order: {
  //       select: {
  //         orderNumber: true,
  //         customer: true
  //       }
  //     }
  //   }
  // });

  return null;
}

/**
 * Export Legal Consents for GDPR Request
 * Customer data export
 */
export async function exportLegalConsentsForCustomer(customerId: string): Promise<string> {
  // Fetch all orders with consent for this customer
  // const orders = await prisma.order.findMany({
  //   where: { customerId },
  //   select: {
  //     orderNumber: true,
  //     createdAt: true,
  //     isCustomProduct: true,
  //     withdrawalExcluded: true,
  //     customizationConfirmedAt: true,
  //     customizationConfirmationIP: true,
  //     legalTextVersion: true
  //   }
  // });

  return `
LEGAL CONSENT DATA EXPORT (GDPR)
────────────────────────────────────────
Customer ID: ${customerId}
Export Date: ${new Date().toISOString()}

Custom Product Orders:
(No data available in placeholder implementation)
  `.trim();
}

/**
 * Import for validation
 */
import { validateLegalConsent } from '@/lib/legal/legal-texts';
