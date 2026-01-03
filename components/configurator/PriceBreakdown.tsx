/**
 * Price Breakdown Display Component (Phase 5)
 * 
 * Shows transparent price calculation with live updates
 * Displays: base product + customization + components = total
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import React from 'react';
import { PriceBreakdownLine, formatPrice } from '@/lib/configurator/pricing-calculator';

/**
 * Price Breakdown Component Props
 */
export interface PriceBreakdownProps {
  /**
   * Breakdown lines from price calculation
   */
  breakdown: PriceBreakdownLine[];

  /**
   * Final price (net)
   */
  finalPriceNet: number;

  /**
   * Final price (gross, with VAT)
   */
  finalPriceGross: number;

  /**
   * VAT amount
   */
  vatAmount: number;

  /**
   * Currency
   */
  currency?: string;

  /**
   * Show expandable details
   */
  expandable?: boolean;

  /**
   * Initially expanded
   */
  initiallyExpanded?: boolean;

  /**
   * Compact mode (hide subtitles)
   */
  compact?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

/**
 * Price Breakdown Display
 * Shows itemized price calculation
 */
export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  breakdown,
  finalPriceNet,
  finalPriceGross,
  vatAmount,
  currency = 'EUR',
  expandable = true,
  initiallyExpanded = false,
  compact = false,
  className = ''
}) => {
  const [expanded, setExpanded] = React.useState(initiallyExpanded);

  const toggleExpanded = () => setExpanded(!expanded);

  return (
    <div className={`price-breakdown ${className}`}>
      {/* Total Price (always visible) */}
      <div className="price-total">
        <div className="price-total-label">
          <span className="label-main">Gesamtpreis</span>
          <span className="label-vat">inkl. MwSt.</span>
        </div>
        <div className="price-total-amount">
          {formatPrice(finalPriceGross, currency)}
        </div>
      </div>

      {/* Expandable Toggle */}
      {expandable && (
        <button
          type="button"
          onClick={toggleExpanded}
          className="breakdown-toggle"
          aria-expanded={expanded}
        >
          {expanded ? '▼' : '▶'} Preisaufschlüsselung
        </button>
      )}

      {/* Breakdown Details */}
      {(!expandable || expanded) && (
        <div className="breakdown-details">
          <div className="breakdown-lines">
            {breakdown.map((line, index) => (
              <div
                key={index}
                className={`breakdown-line ${line.isPremium ? 'is-premium' : ''}`}
              >
                <div className="line-label">
                  <span className="label-text">{line.label}</span>
                  {!compact && line.subtitle && (
                    <span className="label-subtitle">{line.subtitle}</span>
                  )}
                  {line.isPremium && (
                    <span className="premium-badge">Premium</span>
                  )}
                </div>
                <div className="line-price">
                  {line.quantity && line.quantity > 1 && (
                    <span className="quantity">{line.quantity}×</span>
                  )}
                  <span className="amount">
                    {formatPrice(line.priceNet, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal and VAT */}
          <div className="breakdown-summary">
            <div className="summary-line">
              <span className="summary-label">Zwischensumme (netto)</span>
              <span className="summary-amount">
                {formatPrice(finalPriceNet, currency)}
              </span>
            </div>
            <div className="summary-line vat-line">
              <span className="summary-label">MwSt. (19%)</span>
              <span className="summary-amount">
                {formatPrice(vatAmount, currency)}
              </span>
            </div>
            <div className="summary-line total-line">
              <span className="summary-label">Gesamtpreis</span>
              <span className="summary-amount">
                {formatPrice(finalPriceGross, currency)}
              </span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .price-breakdown {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .price-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .price-total-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .label-main {
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .label-vat {
          font-size: 12px;
          color: #666;
        }

        .price-total-amount {
          font-size: 28px;
          font-weight: 700;
          color: #1976d2;
        }

        .breakdown-toggle {
          width: 100%;
          background: none;
          border: none;
          padding: 12px 0;
          text-align: left;
          font-size: 14px;
          color: #1976d2;
          cursor: pointer;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .breakdown-toggle:hover {
          color: #1565c0;
        }

        .breakdown-details {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .breakdown-lines {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .breakdown-line {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px 0;
        }

        .breakdown-line.is-premium {
          background: #f0f7ff;
          padding: 12px;
          border-radius: 6px;
          border-left: 3px solid #1976d2;
        }

        .line-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .label-text {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .label-subtitle {
          font-size: 12px;
          color: #666;
        }

        .premium-badge {
          display: inline-block;
          background: #1976d2;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 4px;
          width: fit-content;
        }

        .line-price {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .quantity {
          color: #666;
          font-size: 13px;
        }

        .breakdown-summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }

        .summary-label {
          color: #666;
        }

        .summary-amount {
          font-weight: 600;
          color: #333;
        }

        .vat-line {
          font-size: 13px;
        }

        .total-line {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid #e0e0e0;
          font-size: 16px;
        }

        .total-line .summary-label {
          font-weight: 600;
          color: #333;
        }

        .total-line .summary-amount {
          font-size: 18px;
          color: #1976d2;
        }
      `}</style>
    </div>
  );
};

/**
 * Compact Price Display
 * Shows only total price (for mobile/sidebar)
 */
export const CompactPriceDisplay: React.FC<{
  finalPriceGross: number;
  currency?: string;
  label?: string;
  showVat?: boolean;
}> = ({
  finalPriceGross,
  currency = 'EUR',
  label = 'Preis',
  showVat = true
}) => {
  return (
    <div className="compact-price-display">
      <span className="price-label">{label}</span>
      <span className="price-amount">{formatPrice(finalPriceGross, currency)}</span>
      {showVat && <span className="price-vat">inkl. MwSt.</span>}

      <style jsx>{`
        .compact-price-display {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .price-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .price-amount {
          font-size: 24px;
          font-weight: 700;
          color: #1976d2;
        }

        .price-vat {
          font-size: 11px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

/**
 * Price Comparison Display
 * Shows "was / now" pricing (for upsells)
 */
export const PriceComparison: React.FC<{
  originalPrice: number;
  currentPrice: number;
  currency?: string;
  savings?: boolean;
}> = ({
  originalPrice,
  currentPrice,
  currency = 'EUR',
  savings = true
}) => {
  const savingsAmount = originalPrice - currentPrice;
  const savingsPercent = ((savingsAmount / originalPrice) * 100).toFixed(0);

  return (
    <div className="price-comparison">
      <span className="price-original">{formatPrice(originalPrice, currency)}</span>
      <span className="price-current">{formatPrice(currentPrice, currency)}</span>
      {savings && savingsAmount > 0 && (
        <span className="price-savings">
          Sie sparen {formatPrice(savingsAmount, currency)} ({savingsPercent}%)
        </span>
      )}

      <style jsx>{`
        .price-comparison {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .price-original {
          font-size: 16px;
          color: #999;
          text-decoration: line-through;
        }

        .price-current {
          font-size: 20px;
          font-weight: 700;
          color: #d32f2f;
        }

        .price-savings {
          font-size: 13px;
          color: #2e7d32;
          font-weight: 600;
          background: #e8f5e9;
          padding: 4px 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

/**
 * Example Usage:
 * 
 * ```tsx
 * import { PriceBreakdown } from '@/components/configurator/PriceBreakdown';
 * import { usePriceCalculation } from '@/lib/configurator/pricing-calculator';
 * 
 * function ConfiguratorPage() {
 *   const { priceResult } = usePriceCalculation(
 *     'UNBREAK-GLAS-SET-2',
 *     selectedComponents
 *   );
 * 
 *   if (!priceResult) return null;
 * 
 *   return (
 *     <div>
 *       <PriceBreakdown
 *         breakdown={priceResult.breakdown}
 *         finalPriceNet={priceResult.finalPriceNet}
 *         finalPriceGross={priceResult.finalPriceGross}
 *         vatAmount={priceResult.vatAmount}
 *         expandable={true}
 *         initiallyExpanded={false}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
