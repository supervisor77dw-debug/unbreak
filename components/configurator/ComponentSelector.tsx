/**
 * Component Selector with Upsell UI (Phase 5)
 * 
 * Component picker with premium highlighting and upsell mechanics
 * Visual emphasis on premium options with persuasive copy
 * 
 * @version 1.0.0
 * @date 2026-01-03
 */

import React from 'react';
import {
  ComponentDefinition,
  getComponentsByCategory,
  getRecommendedUpsells
} from '@/lib/configurator/component-catalog';
import { SelectedComponent, formatPriceDelta } from '@/lib/configurator/pricing-calculator';

/**
 * Component Selector Props
 */
export interface ComponentSelectorProps {
  /**
   * Component category to display
   */
  category: 'material' | 'finish' | 'addon';

  /**
   * Currently selected component IDs
   */
  selectedComponentIds: string[];

  /**
   * Callback when component is selected
   */
  onSelect: (component: SelectedComponent) => void;

  /**
   * Callback when component is deselected
   */
  onDeselect: (componentId: string) => void;

  /**
   * Allow multiple selections (for addons)
   */
  multiSelect?: boolean;

  /**
   * Show price deltas
   */
  showPricing?: boolean;

  /**
   * Highlight premium options
   */
  highlightPremium?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

/**
 * Component Selector
 * Grid of selectable components with premium highlighting
 */
export const ComponentSelector: React.FC<ComponentSelectorProps> = ({
  category,
  selectedComponentIds,
  onSelect,
  onDeselect,
  multiSelect = false,
  showPricing = true,
  highlightPremium = true,
  className = ''
}) => {
  const components = getComponentsByCategory(category);

  const handleClick = (component: ComponentDefinition) => {
    const isSelected = selectedComponentIds.includes(component.componentId);

    if (isSelected) {
      onDeselect(component.componentId);
    } else {
      // Single select: deselect all other components in same category
      if (!multiSelect) {
        const otherSelected = components.filter(c =>
          selectedComponentIds.includes(c.componentId) &&
          c.componentId !== component.componentId
        );
        otherSelected.forEach(c => onDeselect(c.componentId));
      }

      onSelect({
        componentId: component.componentId,
        label: component.label,
        category: component.category,
        priceDelta: component.priceDelta,
        isPremium: component.isPremium
      });
    }
  };

  return (
    <div className={`component-selector ${className}`}>
      <div className="selector-grid">
        {components.map(component => {
          const isSelected = selectedComponentIds.includes(component.componentId);
          const isPremium = highlightPremium && component.isPremium;

          return (
            <button
              key={component.componentId}
              onClick={() => handleClick(component)}
              className={`
                component-card
                ${isSelected ? 'is-selected' : ''}
                ${isPremium ? 'is-premium' : ''}
              `}
              type="button"
            >
              {/* Premium Badge */}
              {isPremium && component.upsellText && (
                <div className="premium-badge">
                  <span className="badge-icon">★</span>
                  <span className="badge-text">{component.upsellText}</span>
                </div>
              )}

              {/* Component Label */}
              <div className="card-header">
                <h3 className="card-title">{component.label}</h3>
                {showPricing && (
                  <div className="card-price">
                    {component.priceDelta === 0 ? (
                      <span className="price-free">Inklusive</span>
                    ) : (
                      <span className="price-delta">
                        {formatPriceDelta(component.priceDelta)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              {component.description && (
                <p className="card-description">{component.description}</p>
              )}

              {/* Preview Image */}
              {component.previewUrl && (
                <div className="card-preview">
                  <img src={component.previewUrl} alt={component.label} />
                </div>
              )}

              {/* Selection Indicator */}
              <div className="selection-indicator">
                {isSelected ? (
                  <span className="indicator-selected">✓ Ausgewählt</span>
                ) : (
                  <span className="indicator-default">Auswählen</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .component-selector {
          width: 100%;
        }

        .selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .component-card {
          position: relative;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .component-card:hover {
          border-color: #1976d2;
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
          transform: translateY(-2px);
        }

        .component-card.is-selected {
          border-color: #1976d2;
          background: #f0f7ff;
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
        }

        .component-card.is-premium {
          border-color: #ffa726;
          background: linear-gradient(135deg, #fffaf0 0%, #fff 100%);
        }

        .component-card.is-premium.is-selected {
          border-color: #ff9800;
          background: linear-gradient(135deg, #fff3e0 0%, #f0f7ff 100%);
        }

        .premium-badge {
          position: absolute;
          top: -10px;
          right: 16px;
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
        }

        .badge-icon {
          font-size: 14px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .card-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
          flex: 1;
        }

        .card-price {
          flex-shrink: 0;
        }

        .price-free {
          font-size: 13px;
          color: #2e7d32;
          font-weight: 600;
          background: #e8f5e9;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .price-delta {
          font-size: 14px;
          font-weight: 700;
          color: #1976d2;
        }

        .card-description {
          margin: 0;
          font-size: 13px;
          color: #666;
          line-height: 1.5;
        }

        .card-preview {
          width: 100%;
          height: 120px;
          border-radius: 8px;
          overflow: hidden;
          background: #f5f5f5;
        }

        .card-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .selection-indicator {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid #e0e0e0;
          text-align: center;
        }

        .indicator-selected {
          font-size: 14px;
          font-weight: 600;
          color: #1976d2;
        }

        .indicator-default {
          font-size: 14px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

/**
 * Upsell Panel
 * Shows recommended premium components
 */
export const UpsellPanel: React.FC<{
  selectedComponents: SelectedComponent[];
  onSelect: (component: SelectedComponent) => void;
  maxRecommendations?: number;
  className?: string;
}> = ({
  selectedComponents,
  onSelect,
  maxRecommendations = 3,
  className = ''
}) => {
  const recommendations = getRecommendedUpsells(selectedComponents).slice(
    0,
    maxRecommendations
  );

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className={`upsell-panel ${className}`}>
      <h3 className="upsell-title">Beliebte Premium-Optionen</h3>
      <p className="upsell-subtitle">Werten Sie Ihr Produkt auf</p>

      <div className="upsell-cards">
        {recommendations.map(component => (
          <div key={component.componentId} className="upsell-card">
            <div className="upsell-header">
              <span className="upsell-badge">★ Premium</span>
              <span className="upsell-price">
                {formatPriceDelta(component.priceDelta)}
              </span>
            </div>
            <h4 className="upsell-label">{component.label}</h4>
            {component.description && (
              <p className="upsell-description">{component.description}</p>
            )}
            {component.upsellText && (
              <p className="upsell-text">{component.upsellText}</p>
            )}
            <button
              onClick={() => onSelect(component)}
              className="upsell-button"
              type="button"
            >
              Hinzufügen
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .upsell-panel {
          background: linear-gradient(135deg, #fffaf0 0%, #fff 100%);
          border: 2px solid #ffa726;
          border-radius: 12px;
          padding: 24px;
          margin: 24px 0;
        }

        .upsell-title {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 700;
          color: #333;
        }

        .upsell-subtitle {
          margin: 0 0 20px 0;
          font-size: 14px;
          color: #666;
        }

        .upsell-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .upsell-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .upsell-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .upsell-badge {
          background: #ff9800;
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .upsell-price {
          font-size: 16px;
          font-weight: 700;
          color: #1976d2;
        }

        .upsell-label {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .upsell-description {
          margin: 0;
          font-size: 13px;
          color: #666;
          line-height: 1.4;
        }

        .upsell-text {
          margin: 0;
          font-size: 12px;
          color: #ff9800;
          font-weight: 600;
          font-style: italic;
        }

        .upsell-button {
          margin-top: auto;
          background: #1976d2;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .upsell-button:hover {
          background: #1565c0;
        }
      `}</style>
    </div>
  );
};

/**
 * Example Usage:
 * 
 * ```tsx
 * import { ComponentSelector, UpsellPanel } from '@/components/configurator/ComponentSelector';
 * 
 * function ConfiguratorPage() {
 *   const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);
 * 
 *   const handleSelect = (component: SelectedComponent) => {
 *     setSelectedComponents([...selectedComponents, component]);
 *   };
 * 
 *   const handleDeselect = (componentId: string) => {
 *     setSelectedComponents(
 *       selectedComponents.filter(c => c.componentId !== componentId)
 *     );
 *   };
 * 
 *   return (
 *     <div>
 *       <h2>Material wählen</h2>
 *       <ComponentSelector
 *         category="material"
 *         selectedComponentIds={selectedComponents.map(c => c.componentId)}
 *         onSelect={handleSelect}
 *         onDeselect={handleDeselect}
 *         multiSelect={false}
 *         highlightPremium={true}
 *       />
 * 
 *       <UpsellPanel
 *         selectedComponents={selectedComponents}
 *         onSelect={handleSelect}
 *         maxRecommendations={3}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
