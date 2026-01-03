/**
 * Product Page Legal Notice Component
 * 
 * Displays withdrawal exclusion notice BEFORE add-to-cart
 * Required for custom product transparency
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import React from 'react';
import { LEGAL_TEXTS } from '@/lib/legal/legal-texts';

export interface ProductLegalNoticeProps {
  /**
   * Display variant
   */
  variant?: 'short' | 'extended';

  /**
   * Show link to AGB
   */
  showLink?: boolean;

  /**
   * Custom class name
   */
  className?: string;

  /**
   * Icon display
   */
  showIcon?: boolean;
}

export const ProductLegalNotice: React.FC<ProductLegalNoticeProps> = ({
  variant = 'short',
  showLink = true,
  className = '',
  showIcon = true
}) => {
  const text = variant === 'short' 
    ? LEGAL_TEXTS.productPageNotice.short
    : LEGAL_TEXTS.productPageNotice.extended;

  return (
    <div className={`product-legal-notice ${className}`} role="note">
      <div className="notice-content">
        {showIcon && (
          <span className="notice-icon" aria-hidden="true">
            ℹ️
          </span>
        )}
        <p className="notice-text">
          {text}
        </p>
      </div>

      {showLink && (
        <a 
          href={LEGAL_TEXTS.productPageNotice.linkTarget}
          className="notice-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {LEGAL_TEXTS.productPageNotice.linkText}
        </a>
      )}

      <style jsx>{`
        .product-legal-notice {
          background: #f0f7ff;
          border: 1px solid #b3d9ff;
          border-radius: 6px;
          padding: 16px;
          margin: 16px 0;
        }

        .notice-content {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .notice-icon {
          font-size: 20px;
          flex-shrink: 0;
          line-height: 1.4;
        }

        .notice-text {
          margin: 0;
          color: #003d7a;
          font-size: 14px;
          line-height: 1.5;
          font-weight: 500;
        }

        .notice-link {
          display: inline-block;
          margin-top: 10px;
          margin-left: 30px;
          color: #0066cc;
          font-size: 13px;
          text-decoration: none;
          font-weight: 500;
        }

        .notice-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

/**
 * Cart Item Badge Component
 * Shows "Individuelles Produkt" badge in cart
 */
export interface CartItemLegalBadgeProps {
  /**
   * Show tooltip on hover
   */
  showTooltip?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

export const CartItemLegalBadge: React.FC<CartItemLegalBadgeProps> = ({
  showTooltip = true,
  className = ''
}) => {
  return (
    <div className={`cart-legal-badge ${className}`}>
      <span 
        className="badge"
        title={showTooltip ? LEGAL_TEXTS.cartItemNotice.tooltip : undefined}
        aria-label={LEGAL_TEXTS.cartItemNotice.tooltip}
      >
        {LEGAL_TEXTS.cartItemNotice.badge}
      </span>
      <p className="description">
        {LEGAL_TEXTS.cartItemNotice.description}
      </p>

      <style jsx>{`
        .cart-legal-badge {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .badge {
          display: inline-block;
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: help;
        }

        .description {
          margin: 0;
          font-size: 13px;
          color: #666;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

/**
 * Inline Legal Notice (Compact)
 * For use in tight spaces (e.g., price section)
 */
export const InlineLegalNotice: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span className={`inline-legal-notice ${className}`}>
      <span className="icon">⚠️</span>
      <span className="text">Vom Widerrufsrecht ausgeschlossen</span>

      <style jsx>{`
        .inline-legal-notice {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #666;
          font-weight: 500;
        }

        .icon {
          font-size: 14px;
        }

        .text {
          white-space: nowrap;
        }
      `}</style>
    </span>
  );
};

/**
 * Example Usage:
 * 
 * Product Page (before add-to-cart):
 * ```tsx
 * <ProductLegalNotice variant="short" showLink={true} />
 * <button onClick={addToCart}>In den Warenkorb</button>
 * ```
 * 
 * Cart Item:
 * ```tsx
 * <div className="cart-item">
 *   <h3>Glashalter – individuelles Design</h3>
 *   <CartItemLegalBadge />
 *   <p>€180,88</p>
 * </div>
 * ```
 * 
 * Price Section:
 * ```tsx
 * <div className="price">
 *   <span>€180,88</span>
 *   <InlineLegalNotice />
 * </div>
 * ```
 */
