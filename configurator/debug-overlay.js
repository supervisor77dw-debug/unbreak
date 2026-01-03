/**
 * Debug Overlay - Developer Tooling for Integration Testing
 * 
 * Features:
 * - Event log viewer
 * - Current design state inspector
 * - Payload size calculator
 * - Copy design JSON to clipboard
 * - Manual trigger for export/import
 * - Origin validation status
 */

export class DebugOverlay {
  constructor(integrationManager, options = {}) {
    this.integration = integrationManager;
    this.options = {
      position: options.position || 'bottom-right',
      collapsed: options.collapsed !== false,
      ...options
    };
    
    this.overlay = null;
    this.isCollapsed = this.options.collapsed;
    
    this._createOverlay();
    this._attachEventHandlers();
    this._startAutoRefresh();
  }
  
  /**
   * Create overlay DOM
   * @private
   */
  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'integration-debug-overlay';
    this.overlay.className = `debug-overlay ${this.options.position} ${this.isCollapsed ? 'collapsed' : ''}`;
    
    this.overlay.innerHTML = `
      <div class="debug-header">
        <span class="debug-title">🔧 Integration Debug</span>
        <button class="debug-toggle" title="Toggle">−</button>
        <button class="debug-close" title="Close">×</button>
      </div>
      
      <div class="debug-content">
        <!-- Tabs -->
        <div class="debug-tabs">
          <button class="debug-tab active" data-tab="events">Events</button>
          <button class="debug-tab" data-tab="design">Design</button>
          <button class="debug-tab" data-tab="actions">Actions</button>
        </div>
        
        <!-- Events Tab -->
        <div class="debug-tab-content active" data-tab-content="events">
          <div class="debug-section">
            <div class="debug-section-header">
              <span>Event Log (last 50)</span>
              <button class="debug-clear-log btn-small">Clear</button>
            </div>
            <div class="debug-event-log" id="debug-event-log"></div>
          </div>
        </div>
        
        <!-- Design Tab -->
        <div class="debug-tab-content" data-tab-content="design">
          <div class="debug-section">
            <div class="debug-section-header">
              <span>Current Design</span>
              <button class="debug-copy-json btn-small">Copy JSON</button>
            </div>
            <div class="debug-stats">
              <div class="stat">
                <span class="stat-label">Design ID:</span>
                <span class="stat-value" id="debug-design-id">-</span>
              </div>
              <div class="stat">
                <span class="stat-label">Product:</span>
                <span class="stat-value" id="debug-product-key">-</span>
              </div>
              <div class="stat">
                <span class="stat-label">Valid:</span>
                <span class="stat-value" id="debug-valid">-</span>
              </div>
              <div class="stat">
                <span class="stat-label">Payload Size:</span>
                <span class="stat-value" id="debug-payload-size">-</span>
              </div>
              <div class="stat">
                <span class="stat-label">Updated:</span>
                <span class="stat-value" id="debug-updated">-</span>
              </div>
            </div>
            <div class="debug-json-viewer">
              <pre id="debug-json-display"></pre>
            </div>
          </div>
        </div>
        
        <!-- Actions Tab -->
        <div class="debug-tab-content" data-tab-content="actions">
          <div class="debug-section">
            <div class="debug-section-header">
              <span>Manual Actions</span>
            </div>
            <div class="debug-actions">
              <button class="debug-action-btn" id="debug-trigger-ready">Send READY</button>
              <button class="debug-action-btn" id="debug-trigger-change">Trigger CONFIG_CHANGED</button>
              <button class="debug-action-btn" id="debug-trigger-error">Send Error</button>
              <button class="debug-action-btn" id="debug-ping">Send PING</button>
            </div>
            
            <div class="debug-section-header" style="margin-top: 16px;">
              <span>Test Import</span>
            </div>
            <textarea class="debug-import-json" id="debug-import-json" placeholder="Paste DesignPayload JSON here..."></textarea>
            <button class="debug-action-btn" id="debug-test-import">Test Import</button>
            
            <div class="debug-section-header" style="margin-top: 16px;">
              <span>Origin Validation</span>
            </div>
            <div class="debug-origins">
              <div class="stat-label">Allowed Origins:</div>
              <ul id="debug-allowed-origins"></ul>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.overlay);
    this._injectStyles();
  }
  
  /**
   * Attach event handlers
   * @private
   */
  _attachEventHandlers() {
    // Toggle collapse
    this.overlay.querySelector('.debug-toggle').addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      this.overlay.classList.toggle('collapsed', this.isCollapsed);
      this.overlay.querySelector('.debug-toggle').textContent = this.isCollapsed ? '+' : '−';
    });
    
    // Close
    this.overlay.querySelector('.debug-close').addEventListener('click', () => {
      this.destroy();
    });
    
    // Tab switching
    this.overlay.querySelectorAll('.debug-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this._switchTab(tabName);
      });
    });
    
    // Clear log
    this.overlay.querySelector('.debug-clear-log').addEventListener('click', () => {
      this.integration.clearEventLog();
      this._updateEventLog();
    });
    
    // Copy JSON
    this.overlay.querySelector('.debug-copy-json').addEventListener('click', () => {
      this._copyDesignToClipboard();
    });
    
    // Action buttons
    this.overlay.querySelector('#debug-trigger-ready').addEventListener('click', () => {
      this.integration.notifyReady();
    });
    
    this.overlay.querySelector('#debug-trigger-change').addEventListener('click', () => {
      this.integration._broadcastConfigChanged();
    });
    
    this.overlay.querySelector('#debug-trigger-error').addEventListener('click', () => {
      this.integration.notifyError('Test error from debug overlay');
    });
    
    this.overlay.querySelector('#debug-ping').addEventListener('click', () => {
      // Simulate PING by sending to parent
      this.integration._broadcastMessage('PING', {});
    });
    
    this.overlay.querySelector('#debug-test-import').addEventListener('click', () => {
      this._testImport();
    });
  }
  
  /**
   * Switch active tab
   * @private
   */
  _switchTab(tabName) {
    // Update tab buttons
    this.overlay.querySelectorAll('.debug-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    this.overlay.querySelectorAll('.debug-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabName);
    });
  }
  
  /**
   * Start auto-refresh timer
   * @private
   */
  _startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this._refresh();
    }, 1000);
  }
  
  /**
   * Refresh all displays
   * @private
   */
  _refresh() {
    this._updateEventLog();
    this._updateDesignDisplay();
    this._updateOriginsList();
  }
  
  /**
   * Update event log display
   * @private
   */
  _updateEventLog() {
    const logEl = this.overlay.querySelector('#debug-event-log');
    const events = this.integration.getEventLog();
    
    if (events.length === 0) {
      logEl.innerHTML = '<div class="debug-empty">No events yet</div>';
      return;
    }
    
    logEl.innerHTML = events.map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString('de-DE');
      const className = event.isError ? 'error' : 'success';
      return `
        <div class="debug-event ${className}">
          <span class="event-time">${time}</span>
          <span class="event-message">${this._escapeHtml(event.message)}</span>
          ${event.data ? `<pre class="event-data">${JSON.stringify(event.data, null, 2)}</pre>` : ''}
        </div>
      `;
    }).join('');
    
    logEl.scrollTop = logEl.scrollHeight;
  }
  
  /**
   * Update design display
   * @private
   */
  _updateDesignDisplay() {
    const design = this.integration.getCurrentDesign();
    
    if (!design) {
      this.overlay.querySelector('#debug-design-id').textContent = '-';
      this.overlay.querySelector('#debug-product-key').textContent = '-';
      this.overlay.querySelector('#debug-valid').textContent = '-';
      this.overlay.querySelector('#debug-payload-size').textContent = '-';
      this.overlay.querySelector('#debug-updated').textContent = '-';
      this.overlay.querySelector('#debug-json-display').textContent = 'No design loaded';
      return;
    }
    
    const size = new Blob([JSON.stringify(design)]).size;
    const sizeFormatted = size < 1024 ? `${size} B` : 
                          size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` :
                          `${(size / (1024 * 1024)).toFixed(2)} MB`;
    
    this.overlay.querySelector('#debug-design-id').textContent = design.designId.substring(0, 8) + '...';
    this.overlay.querySelector('#debug-product-key').textContent = design.productKey;
    this.overlay.querySelector('#debug-valid').textContent = design.validation.isValid ? '✓ Yes' : '✗ No';
    this.overlay.querySelector('#debug-payload-size').textContent = sizeFormatted;
    this.overlay.querySelector('#debug-updated').textContent = new Date(design.updatedAt).toLocaleTimeString('de-DE');
    this.overlay.querySelector('#debug-json-display').textContent = JSON.stringify(design, null, 2);
  }
  
  /**
   * Update origins list
   * @private
   */
  _updateOriginsList() {
    const originsEl = this.overlay.querySelector('#debug-allowed-origins');
    const origins = this.integration.options.allowedOrigins;
    
    originsEl.innerHTML = origins.map(origin => 
      `<li><code>${this._escapeHtml(origin)}</code></li>`
    ).join('');
  }
  
  /**
   * Copy design to clipboard
   * @private
   */
  async _copyDesignToClipboard() {
    const design = this.integration.getCurrentDesign();
    if (!design) {
      alert('No design to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(design, null, 2));
      alert('Design JSON copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback: select text
      const jsonDisplay = this.overlay.querySelector('#debug-json-display');
      const range = document.createRange();
      range.selectNodeContents(jsonDisplay);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  
  /**
   * Test import from textarea
   * @private
   */
  _testImport() {
    const jsonText = this.overlay.querySelector('#debug-import-json').value.trim();
    if (!jsonText) {
      alert('Please paste a DesignPayload JSON first');
      return;
    }
    
    try {
      const payload = JSON.parse(jsonText);
      
      // Simulate import message
      this.integration._handleImportDesign({ designPayload: payload }, window.location.origin);
      
      alert('Import triggered! Check event log for result.');
    } catch (error) {
      alert(`Invalid JSON: ${error.message}`);
    }
  }
  
  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Inject styles
   * @private
   */
  _injectStyles() {
    if (document.getElementById('debug-overlay-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'debug-overlay-styles';
    style.textContent = `
      .debug-overlay {
        position: fixed;
        background: rgba(0, 0, 0, 0.95);
        color: #0f0;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        border: 1px solid #0f0;
        border-radius: 4px;
        z-index: 999999;
        max-width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3);
      }
      
      .debug-overlay.bottom-right {
        bottom: 16px;
        right: 16px;
        width: 500px;
      }
      
      .debug-overlay.collapsed .debug-content {
        display: none;
      }
      
      .debug-header {
        padding: 8px 12px;
        background: #0a0a0a;
        border-bottom: 1px solid #0f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: move;
      }
      
      .debug-title {
        font-weight: bold;
        flex: 1;
      }
      
      .debug-toggle,
      .debug-close {
        background: transparent;
        border: 1px solid #0f0;
        color: #0f0;
        cursor: pointer;
        padding: 2px 8px;
        margin-left: 8px;
        border-radius: 2px;
      }
      
      .debug-toggle:hover,
      .debug-close:hover {
        background: #0f0;
        color: #000;
      }
      
      .debug-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .debug-tabs {
        display: flex;
        border-bottom: 1px solid #0f0;
        background: #0a0a0a;
      }
      
      .debug-tab {
        flex: 1;
        padding: 8px;
        background: transparent;
        border: none;
        border-right: 1px solid #0f0;
        color: #0f0;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
      }
      
      .debug-tab:last-child {
        border-right: none;
      }
      
      .debug-tab:hover {
        background: rgba(0, 255, 0, 0.1);
      }
      
      .debug-tab.active {
        background: rgba(0, 255, 0, 0.2);
        font-weight: bold;
      }
      
      .debug-tab-content {
        display: none;
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }
      
      .debug-tab-content.active {
        display: block;
      }
      
      .debug-section {
        margin-bottom: 16px;
      }
      
      .debug-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(0, 255, 0, 0.3);
        font-weight: bold;
      }
      
      .btn-small {
        background: transparent;
        border: 1px solid #0f0;
        color: #0f0;
        padding: 2px 8px;
        font-size: 10px;
        cursor: pointer;
        border-radius: 2px;
        font-family: inherit;
      }
      
      .btn-small:hover {
        background: #0f0;
        color: #000;
      }
      
      .debug-event-log {
        max-height: 300px;
        overflow-y: auto;
        background: #0a0a0a;
        padding: 8px;
        border: 1px solid rgba(0, 255, 0, 0.3);
        border-radius: 2px;
      }
      
      .debug-event {
        margin-bottom: 8px;
        padding: 4px;
        border-left: 3px solid;
      }
      
      .debug-event.success {
        border-left-color: #0f0;
      }
      
      .debug-event.error {
        border-left-color: #f00;
        color: #f00;
      }
      
      .event-time {
        opacity: 0.7;
        margin-right: 8px;
      }
      
      .event-data {
        margin-top: 4px;
        margin-left: 16px;
        font-size: 10px;
        opacity: 0.8;
        background: rgba(0, 255, 0, 0.05);
        padding: 4px;
        border-radius: 2px;
      }
      
      .debug-empty {
        opacity: 0.5;
        text-align: center;
        padding: 16px;
      }
      
      .debug-stats {
        background: #0a0a0a;
        padding: 8px;
        border: 1px solid rgba(0, 255, 0, 0.3);
        border-radius: 2px;
        margin-bottom: 12px;
      }
      
      .stat {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid rgba(0, 255, 0, 0.1);
      }
      
      .stat:last-child {
        border-bottom: none;
      }
      
      .stat-label {
        opacity: 0.7;
      }
      
      .stat-value {
        font-weight: bold;
      }
      
      .debug-json-viewer {
        background: #0a0a0a;
        border: 1px solid rgba(0, 255, 0, 0.3);
        border-radius: 2px;
        max-height: 300px;
        overflow: auto;
      }
      
      .debug-json-viewer pre {
        margin: 0;
        padding: 8px;
        font-size: 10px;
        line-height: 1.4;
      }
      
      .debug-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .debug-action-btn {
        background: transparent;
        border: 1px solid #0f0;
        color: #0f0;
        padding: 8px;
        cursor: pointer;
        border-radius: 2px;
        font-family: inherit;
        font-size: inherit;
      }
      
      .debug-action-btn:hover {
        background: rgba(0, 255, 0, 0.1);
      }
      
      .debug-import-json {
        width: 100%;
        height: 100px;
        background: #0a0a0a;
        border: 1px solid rgba(0, 255, 0, 0.3);
        color: #0f0;
        font-family: inherit;
        font-size: 10px;
        padding: 8px;
        border-radius: 2px;
        resize: vertical;
        margin-bottom: 8px;
      }
      
      .debug-origins ul {
        list-style: none;
        padding: 0;
        margin: 8px 0 0 0;
      }
      
      .debug-origins li {
        padding: 4px;
        background: rgba(0, 255, 0, 0.05);
        margin-bottom: 4px;
        border-radius: 2px;
      }
      
      .debug-origins code {
        color: #0f0;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Clean up
   * @public
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
