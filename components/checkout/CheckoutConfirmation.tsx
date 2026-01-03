/**
 * Checkout Confirmation Checkbox Component
 * 
 * MANDATORY legal consent for custom products
 * Blocks checkout if not confirmed
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import React, { useState } from 'react';
import { LEGAL_TEXTS } from '@/lib/legal/legal-texts';

export interface CheckoutConfirmationProps {
  /**
   * Callback when confirmation state changes
   */
  onConfirmationChange: (confirmed: boolean) => void;

  /**
   * Force show validation error
   */
  showError?: boolean;

  /**
   * Custom class name for styling
   */
  className?: string;

  /**
   * Show expandable explanation
   */
  showExpandable?: boolean;
}

export const CheckoutConfirmation: React.FC<CheckoutConfirmationProps> = ({
  onConfirmationChange,
  showError = false,
  className = '',
  showExpandable = true
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isConfirmed = e.target.checked;
    setConfirmed(isConfirmed);
    onConfirmationChange(isConfirmed);
  };

  return (
    <div className={`checkout-confirmation ${className}`}>
      <div className="confirmation-checkbox-wrapper">
        <label className="confirmation-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={handleChange}
            required
            aria-label={LEGAL_TEXTS.checkoutConfirmation.ariaLabel}
            aria-describedby="confirmation-text"
            className="confirmation-checkbox"
          />
          <span 
            id="confirmation-text" 
            className="confirmation-text"
          >
            {LEGAL_TEXTS.checkoutConfirmation.checkboxLabel}
          </span>
        </label>

        {showExpandable && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="confirmation-expand-btn"
            aria-expanded={expanded}
          >
            {expanded ? 'Weniger anzeigen' : 'Mehr erfahren'}
          </button>
        )}
      </div>

      {showExpandable && expanded && (
        <div className="confirmation-expandable">
          <p className="confirmation-explanation">
            {LEGAL_TEXTS.checkoutConfirmation.expandableText}
          </p>
          <a 
            href={LEGAL_TEXTS.productPageNotice.linkTarget}
            target="_blank"
            rel="noopener noreferrer"
            className="confirmation-link"
          >
            {LEGAL_TEXTS.productPageNotice.linkText}
          </a>
        </div>
      )}

      {showError && !confirmed && (
        <div className="confirmation-error" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-text">
            {LEGAL_TEXTS.checkoutConfirmation.validationError}
          </span>
        </div>
      )}

      <style jsx>{`
        .checkout-confirmation {
          background: #f9f9f9;
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .confirmation-checkbox-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .confirmation-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          font-size: 15px;
          line-height: 1.5;
        }

        .confirmation-checkbox {
          margin-top: 3px;
          width: 20px;
          height: 20px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .confirmation-text {
          flex: 1;
          color: #333;
          font-weight: 500;
        }

        .confirmation-expand-btn {
          background: none;
          border: none;
          color: #0066cc;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          text-decoration: underline;
          align-self: flex-start;
          margin-left: 32px;
        }

        .confirmation-expand-btn:hover {
          color: #004499;
        }

        .confirmation-expandable {
          margin-top: 16px;
          padding: 16px;
          background: white;
          border-radius: 6px;
          border-left: 4px solid #0066cc;
        }

        .confirmation-explanation {
          margin: 0 0 12px 0;
          color: #555;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-line;
        }

        .confirmation-link {
          color: #0066cc;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }

        .confirmation-link:hover {
          text-decoration: underline;
        }

        .confirmation-error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 12px;
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 6px;
          color: #856404;
        }

        .error-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .error-text {
          font-size: 14px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

/**
 * Checkout Validation Hook
 * Use in checkout page to enforce confirmation
 */
export function useCheckoutConfirmation() {
  const [confirmed, setConfirmed] = useState(false);
  const [showError, setShowError] = useState(false);

  const validateConfirmation = (): boolean => {
    if (!confirmed) {
      setShowError(true);
      return false;
    }
    return true;
  };

  const resetValidation = () => {
    setShowError(false);
  };

  return {
    confirmed,
    setConfirmed,
    showError,
    validateConfirmation,
    resetValidation
  };
}

/**
 * Example Usage:
 * 
 * ```tsx
 * import { CheckoutConfirmation, useCheckoutConfirmation } from '@/components/checkout/CheckoutConfirmation';
 * 
 * function CheckoutPage() {
 *   const { confirmed, setConfirmed, showError, validateConfirmation } = useCheckoutConfirmation();
 *   
 *   const handleCheckout = async () => {
 *     if (!validateConfirmation()) {
 *       return; // Block checkout
 *     }
 *     
 *     // Proceed with order...
 *     const consentData = createLegalConsentRecord(
 *       customerIP,
 *       navigator.userAgent,
 *       sessionId
 *     );
 *     
 *     await submitOrder({ ...orderData, legalConsent: consentData });
 *   };
 *   
 *   return (
 *     <div>
 *       <CheckoutConfirmation
 *         onConfirmationChange={setConfirmed}
 *         showError={showError}
 *       />
 *       <button onClick={handleCheckout} disabled={!confirmed}>
 *         Kostenpflichtig bestellen
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
