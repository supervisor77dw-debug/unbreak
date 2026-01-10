/**
 * UNBREAK ONE - Bridge Debug Panel UI
 * 
 * Visual debug panel for monitoring iframe communication
 */

(function() {
  'use strict';

  const PANEL_HTML = `
    <div id="unbreak-debug-panel" style="display: none; position: fixed; bottom: 0; right: 0; width: 600px; max-height: 500px; background: #1e293b; color: #e2e8f0; border: 2px solid #0891b2; border-radius: 8px 0 0 0; font-family: monospace; font-size: 11px; z-index: 999999; box-shadow: 0 -4px 20px rgba(0,0,0,0.5);">
      
      <!-- Header -->
      <div style="background: #0f172a; padding: 12px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
        <strong style="color: #0891b2; font-size: 13px;">🔍 BRIDGE DEBUG PANEL</strong>
        <div style="display: flex; gap: 8px;">
          <button id="debug-panel-clear" style="background: #475569; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">Clear</button>
          <button id="debug-panel-copy" style="background: #0891b2; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">Copy Dump</button>
          <button id="debug-panel-close" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">×</button>
        </div>
      </div>

      <!-- Stats -->
      <div style="padding: 8px 12px; background: #0f172a; border-bottom: 1px solid #334155; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 10px;">
        <div>
          <div style="color: #94a3b8;">Received</div>
          <div id="stat-received" style="color: #0891b2; font-weight: bold;">0</div>
        </div>
        <div>
          <div style="color: #94a3b8;">Sent</div>
          <div id="stat-sent" style="color: #10b981; font-weight: bold;">0</div>
        </div>
        <div>
          <div style="color: #94a3b8;">Dropped</div>
          <div id="stat-dropped" style="color: #f59e0b; font-weight: bold;">0</div>
        </div>
        <div>
          <div style="color: #94a3b8;">Checkout</div>
          <div id="stat-checkout" style="color: #8b5cf6; font-weight: bold;">0</div>
        </div>
      </div>

      <!-- Current Status -->
      <div style="padding: 8px 12px; background: #0f172a; border-bottom: 1px solid #334155; font-size: 10px;">
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <div>
            <span style="color: #94a3b8;">Last Message:</span>
            <span id="status-last-msg" style="color: #e2e8f0; margin-left: 4px;">-</span>
          </div>
          <div>
            <span style="color: #94a3b8;">Last Drop:</span>
            <span id="status-last-drop" style="color: #f59e0b; margin-left: 4px;">-</span>
          </div>
          <div>
            <span style="color: #94a3b8;">Checkout Status:</span>
            <span id="status-checkout" style="color: #94a3b8; margin-left: 4px;">idle</span>
          </div>
        </div>
      </div>

      <!-- Logs -->
      <div style="overflow-y: auto; max-height: 300px; padding: 8px;">
        <table id="debug-log-table" style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead style="position: sticky; top: 0; background: #0f172a;">
            <tr>
              <th style="text-align: left; padding: 4px; color: #94a3b8; border-bottom: 1px solid #334155;">Time</th>
              <th style="text-align: left; padding: 4px; color: #94a3b8; border-bottom: 1px solid #334155;">Stage</th>
              <th style="text-align: left; padding: 4px; color: #94a3b8; border-bottom: 1px solid #334155;">Details</th>
            </tr>
          </thead>
          <tbody id="debug-log-body">
            <tr>
              <td colspan="3" style="padding: 20px; text-align: center; color: #64748b;">No logs yet...</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  `;

  class DebugPanelUI {
    constructor() {
      this.visible = false;
      this.panel = null;
      this.init();
    }

    init() {
      // Inject HTML
      const container = document.createElement('div');
      container.innerHTML = PANEL_HTML;
      document.body.appendChild(container.firstElementChild);

      this.panel = document.getElementById('unbreak-debug-panel');

      // Bind buttons
      document.getElementById('debug-panel-close').addEventListener('click', () => this.hide());
      document.getElementById('debug-panel-clear').addEventListener('click', () => this.clear());
      document.getElementById('debug-panel-copy').addEventListener('click', () => this.copyDump());

      // Listen to log events
      window.addEventListener('unbreak-bridge-log', (e) => this.addLogEntry(e.detail));

      // Check if should show on load
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === '1') {
        this.show();
      }

      // Keyboard shortcut: Ctrl+Shift+D
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          this.toggle();
        }
      });

      console.log('[DEBUG_PANEL] UI initialized (Ctrl+Shift+D to toggle)');
    }

    show() {
      this.visible = true;
      this.panel.style.display = 'block';
      this.updateStats();
    }

    hide() {
      this.visible = false;
      this.panel.style.display = 'none';
    }

    toggle() {
      if (this.visible) {
        this.hide();
      } else {
        this.show();
      }
    }

    updateStats() {
      if (!window.UnbreakBridgeDebug) return;

      const stats = window.UnbreakBridgeDebug.stats;
      document.getElementById('stat-received').textContent = stats.messagesReceived;
      document.getElementById('stat-sent').textContent = stats.messagesSent;
      document.getElementById('stat-dropped').textContent = stats.messagesDropped;
      document.getElementById('stat-checkout').textContent = stats.checkoutTriggered;

      // Update status
      const lastMsg = window.UnbreakBridgeDebug.lastMessage;
      if (lastMsg) {
        const msgTime = new Date(lastMsg.timestamp).toLocaleTimeString();
        const msgEvent = lastMsg.data?.event || lastMsg.data?.type || '?';
        document.getElementById('status-last-msg').textContent = `${msgEvent} @ ${msgTime}`;
      }

      const lastDrop = window.UnbreakBridgeDebug.lastDropReason;
      if (lastDrop) {
        document.getElementById('status-last-drop').textContent = lastDrop.reason;
      }

      const lastCheckout = window.UnbreakBridgeDebug.lastCheckoutResponse;
      if (lastCheckout) {
        const status = lastCheckout.error ? 'failed' : 'success';
        const statusEl = document.getElementById('status-checkout');
        statusEl.textContent = status;
        statusEl.style.color = lastCheckout.error ? '#ef4444' : '#10b981';
      }
    }

    addLogEntry(entry) {
      const tbody = document.getElementById('debug-log-body');

      // Remove "no logs" placeholder
      if (tbody.children.length === 1 && tbody.children[0].cells.length === 1) {
        tbody.innerHTML = '';
      }

      const row = tbody.insertRow(0); // Insert at top
      
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const timeCell = row.insertCell(0);
      timeCell.textContent = time;
      timeCell.style.padding = '4px';
      timeCell.style.color = '#94a3b8';
      timeCell.style.borderBottom = '1px solid #334155';

      const stageCell = row.insertCell(1);
      stageCell.textContent = entry.stage;
      stageCell.style.padding = '4px';
      stageCell.style.color = this.getStageColor(entry.stage);
      stageCell.style.borderBottom = '1px solid #334155';
      stageCell.style.fontWeight = 'bold';

      const detailsCell = row.insertCell(2);
      detailsCell.textContent = this.formatDetails(entry.details);
      detailsCell.style.padding = '4px';
      detailsCell.style.color = '#e2e8f0';
      detailsCell.style.borderBottom = '1px solid #334155';
      detailsCell.style.fontSize = '9px';

      // Limit rows
      while (tbody.children.length > 50) {
        tbody.deleteRow(tbody.children.length - 1);
      }

      this.updateStats();
    }

    getStageColor(stage) {
      const colorMap = {
        'MESSAGE_RECEIVED': '#0891b2',
        'MESSAGE_SENT': '#10b981',
        'VALIDATION_OK': '#10b981',
        'VALIDATION_FAILED': '#ef4444',
        'DROP': '#f59e0b',
        'HANDLER_MATCHED': '#8b5cf6',
        'CHECKOUT_TRIGGER': '#ec4899',
        'API_CALL_START': '#06b6d4',
        'API_CALL_SUCCESS': '#10b981',
        'API_CALL_FAILED': '#ef4444',
        'REDIRECT_ATTEMPT': '#f59e0b',
      };
      return colorMap[stage] || '#94a3b8';
    }

    formatDetails(details) {
      if (!details || Object.keys(details).length === 0) return '-';
      
      const parts = [];
      for (const [key, value] of Object.entries(details)) {
        if (typeof value === 'object') {
          parts.push(`${key}={...}`);
        } else {
          parts.push(`${key}=${value}`);
        }
      }
      return parts.join(', ');
    }

    clear() {
      if (window.UnbreakBridgeDebug) {
        window.UnbreakBridgeDebug.clear();
      }
      const tbody = document.getElementById('debug-log-body');
      tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #64748b;">No logs yet...</td></tr>';
      this.updateStats();
    }

    copyDump() {
      if (window.UnbreakBridgeDebug) {
        window.UnbreakBridgeDebug.copyDump();
      }
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.UnbreakDebugPanelUI = new DebugPanelUI();
    });
  } else {
    window.UnbreakDebugPanelUI = new DebugPanelUI();
  }

})();
