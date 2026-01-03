/**
 * Configurator Debug Panel (React Component)
 * 
 * Developer debug UI for configurator integration.
 * Shows:
 * - Last design payload JSON
 * - Pricing breakdown
 * - Pricing signature + pricebook version
 * - Message log (host ↔ configurator)
 * - Message timestamps + origins
 * 
 * Toggle: Set env DEBUG_CONFIGURATOR=true or use Ctrl+Shift+K
 */

import { useState, useEffect } from 'react';
import { getPricingSummary } from '../lib/pricing/design-pricing.js';

export default function ConfiguratorDebugPanel({ bridge, isOpen: initialOpen = false }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [currentPayload, setCurrentPayload] = useState(null);
  const [messageLog, setMessageLog] = useState([]);
  const [activeTab, setActiveTab] = useState('payload');
  
  // Toggle with Ctrl+Shift+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Update payload when bridge changes
  useEffect(() => {
    if (!bridge) return;
    
    const interval = setInterval(() => {
      const payload = bridge.getCurrentPayload();
      setCurrentPayload(payload);
      
      const log = bridge.getMessageLog();
      setMessageLog(log);
    }, 500);
    
    return () => clearInterval(interval);
  }, [bridge]);
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#00ff00',
          border: '1px solid #00ff00',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 9998
        }}
      >
        🐛 Debug
      </button>
    );
  }
  
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>⚙️ Configurator Debug Panel</span>
        <div style={styles.headerButtons}>
          <button onClick={() => bridge?.requestCurrentPayload()} style={styles.button}>
            🔄 Refresh
          </button>
          <button onClick={() => copyToClipboard(currentPayload)} style={styles.button}>
            📋 Copy JSON
          </button>
          <button onClick={() => setIsOpen(false)} style={styles.closeButton}>
            ✕
          </button>
        </div>
      </div>
      
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('payload')}
          style={activeTab === 'payload' ? styles.tabActive : styles.tab}
        >
          Payload
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          style={activeTab === 'pricing' ? styles.tabActive : styles.tab}
        >
          Pricing
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          style={activeTab === 'messages' ? styles.tabActive : styles.tab}
        >
          Messages ({messageLog.length})
        </button>
      </div>
      
      <div style={styles.content}>
        {activeTab === 'payload' && <PayloadTab payload={currentPayload} />}
        {activeTab === 'pricing' && <PricingTab payload={currentPayload} />}
        {activeTab === 'messages' && <MessagesTab log={messageLog} />}
      </div>
    </div>
  );
}

function PayloadTab({ payload }) {
  if (!payload) {
    return <div style={styles.emptyState}>No payload yet. Waiting for DESIGN_CHANGED...</div>;
  }
  
  return (
    <div>
      <div style={styles.infoRow}>
        <strong>Design ID:</strong> {payload.designId}
      </div>
      <div style={styles.infoRow}>
        <strong>Product Family:</strong> {payload.productFamily}
      </div>
      <div style={styles.infoRow}>
        <strong>Version:</strong> {payload.version} (Configurator: {payload.configuratorVersion})
      </div>
      <div style={styles.infoRow}>
        <strong>Updated:</strong> {new Date(payload.updatedAt).toLocaleString('de-DE')}
      </div>
      
      <div style={{ marginTop: '12px' }}>
        <strong>JSON:</strong>
        <pre style={styles.json}>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  );
}

function PricingTab({ payload }) {
  if (!payload) {
    return <div style={styles.emptyState}>No payload to price</div>;
  }
  
  const [pricing, setPricing] = useState(null);
  
  useEffect(() => {
    if (payload) {
      // Client-side pricing calculation
      import('../lib/pricing/design-pricing.js').then(({ priceDesign }) => {
        const result = priceDesign(payload);
        setPricing(result);
      });
    }
  }, [payload]);
  
  if (!pricing) {
    return <div style={styles.emptyState}>Calculating...</div>;
  }
  
  return (
    <div>
      <div style={styles.pricingRow}>
        <span>Base Total:</span>
        <strong>{formatEUR(pricing.baseTotal)}</strong>
      </div>
      <div style={styles.pricingRow}>
        <span>Customization Fee:</span>
        <strong>{formatEUR(pricing.customizationFee)}</strong>
      </div>
      <div style={styles.pricingRow}>
        <span>Addons Total:</span>
        <strong>{formatEUR(pricing.addonsTotal)}</strong>
      </div>
      <div style={styles.pricingRow}>
        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Total:</span>
        <strong style={{ fontSize: '14px', color: '#00ff00' }}>
          {formatEUR(pricing.total)}
        </strong>
      </div>
      
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,255,0,0.3)' }}>
        <div style={styles.infoRow}>
          <strong>Pricebook Version:</strong> {pricing.pricebookVersion}
        </div>
        <div style={styles.infoRow}>
          <strong>Signature:</strong>
          <code style={styles.signature}>{pricing.pricingSignature}</code>
        </div>
        <div style={styles.infoRow}>
          <strong>Calculated:</strong> {new Date(pricing.calculatedAt).toLocaleString('de-DE')}
        </div>
      </div>
      
      <div style={{ marginTop: '12px' }}>
        <strong>Breakdown:</strong>
        <div style={styles.breakdown}>
          {pricing.breakdownLines.map((line, i) => (
            <div key={i} style={styles.breakdownLine}>
              <span style={styles.breakdownType}>[{line.type}]</span>
              <span style={styles.breakdownTitle}>{line.title || line.label}</span>
              <span style={styles.breakdownQty}>
                {line.qty ? `${line.qty}x` : ''}
              </span>
              <span style={styles.breakdownPrice}>
                {formatEUR(line.lineTotal)}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {!pricing.valid && (
        <div style={styles.errors}>
          <strong>⚠️ Pricing Errors:</strong>
          <ul>
            {pricing.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MessagesTab({ log }) {
  if (log.length === 0) {
    return <div style={styles.emptyState}>No messages yet</div>;
  }
  
  return (
    <div style={styles.messageLog}>
      {log.map((entry, i) => (
        <div key={i} style={styles.messageEntry}>
          <div style={styles.messageHeader}>
            <span style={{
              ...styles.messageDirection,
              color: entry.direction === 'sent' ? '#00ffff' : '#ffff00'
            }}>
              {entry.direction === 'sent' ? '↑' : '↓'} {entry.type}
            </span>
            <span style={styles.messageTime}>
              {new Date(entry.timestamp).toLocaleTimeString('de-DE')}
            </span>
          </div>
          {entry.payload && (
            <pre style={styles.messagePayload}>
              {JSON.stringify(entry.payload, null, 2).substring(0, 200)}...
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function formatEUR(amount) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

async function copyToClipboard(payload) {
  if (!payload) return;
  const json = JSON.stringify(payload, null, 2);
  await navigator.clipboard.writeText(json);
  alert('Payload copied to clipboard!');
}

const styles = {
  panel: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '500px',
    maxHeight: '700px',
    background: 'rgba(0, 0, 0, 0.95)',
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: '11px',
    border: '1px solid #00ff00',
    borderRadius: '4px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0, 255, 0, 0.3)'
  },
  header: {
    padding: '10px 12px',
    background: 'rgba(0, 255, 0, 0.1)',
    borderBottom: '1px solid #00ff00',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontWeight: 'bold',
    fontSize: '12px'
  },
  headerButtons: {
    display: 'flex',
    gap: '6px'
  },
  button: {
    background: 'transparent',
    border: '1px solid #00ff00',
    color: '#00ff00',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '10px',
    borderRadius: '2px'
  },
  closeButton: {
    background: 'transparent',
    border: '1px solid #00ff00',
    color: '#00ff00',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '2px'
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(0, 255, 0, 0.3)'
  },
  tab: {
    flex: 1,
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(0, 255, 0, 0.6)',
    cursor: 'pointer',
    fontSize: '11px'
  },
  tabActive: {
    flex: 1,
    padding: '8px',
    background: 'rgba(0, 255, 0, 0.1)',
    border: 'none',
    borderBottom: '2px solid #00ff00',
    color: '#00ff00',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px'
  },
  emptyState: {
    color: 'rgba(0, 255, 0, 0.5)',
    textAlign: 'center',
    padding: '20px'
  },
  infoRow: {
    marginBottom: '6px',
    fontSize: '11px'
  },
  json: {
    background: 'rgba(0, 255, 0, 0.05)',
    padding: '8px',
    border: '1px solid rgba(0, 255, 0, 0.3)',
    borderRadius: '2px',
    maxHeight: '300px',
    overflow: 'auto',
    fontSize: '10px',
    margin: '6px 0 0 0'
  },
  signature: {
    fontSize: '9px',
    color: '#00ffff',
    wordBreak: 'break-all'
  },
  pricingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid rgba(0, 255, 0, 0.1)'
  },
  breakdown: {
    marginTop: '6px',
    fontSize: '10px'
  },
  breakdownLine: {
    display: 'flex',
    gap: '8px',
    padding: '4px 0',
    borderBottom: '1px solid rgba(0, 255, 0, 0.05)'
  },
  breakdownType: {
    color: '#ffff00',
    minWidth: '80px'
  },
  breakdownTitle: {
    flex: 1
  },
  breakdownQty: {
    color: 'rgba(0, 255, 0, 0.7)',
    minWidth: '30px'
  },
  breakdownPrice: {
    fontWeight: 'bold',
    minWidth: '70px',
    textAlign: 'right'
  },
  errors: {
    marginTop: '12px',
    padding: '8px',
    background: 'rgba(255, 0, 0, 0.1)',
    border: '1px solid rgba(255, 0, 0, 0.5)',
    color: '#ff6666'
  },
  messageLog: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  messageEntry: {
    padding: '8px',
    background: 'rgba(0, 255, 0, 0.03)',
    borderLeft: '2px solid rgba(0, 255, 0, 0.3)',
    borderRadius: '2px'
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px'
  },
  messageDirection: {
    fontWeight: 'bold'
  },
  messageTime: {
    color: 'rgba(0, 255, 0, 0.5)',
    fontSize: '9px'
  },
  messagePayload: {
    fontSize: '9px',
    color: 'rgba(0, 255, 0, 0.7)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
};
