/**
 * Compact Debug Panel for Configurator
 * 
 * Provides minimal debug UI for developers:
 * - Toggle button to show/hide
 * - Current payload JSON viewer
 * - Last message timestamp
 * - Message event log (last 10)
 * 
 * Much lighter than the full debug-overlay.js
 */

import { getDesignPayloadV1 } from './design-manager.js';
import { MESSAGE_TYPES } from './postmessage-bridge.js';

let panelElement = null;
let isVisible = false;
let messageLog = [];
const MAX_LOG_ENTRIES = 10;

/**
 * Initialize debug panel
 */
export function initDebugPanel() {
  if (panelElement) return; // Already initialized
  
  createPanel();
  attachToggleListener();
  
  console.log('[DebugPanel] Initialized');
}

/**
 * Create panel DOM structure
 */
function createPanel() {
  // Create container
  panelElement = document.createElement('div');
  panelElement.id = 'config-debug-panel';
  panelElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 400px;
    max-height: 600px;
    background: rgba(0, 0, 0, 0.95);
    color: #00ff00;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    border: 1px solid #00ff00;
    border-radius: 4px;
    z-index: 999999;
    display: ${isVisible ? 'flex' : 'none'};
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3);
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 8px 12px;
    background: rgba(0, 255, 0, 0.1);
    border-bottom: 1px solid #00ff00;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <span style="font-weight: bold;">⚙️ Config Debug Panel</span>
    <button id="debug-panel-close" style="
      background: transparent;
      border: 1px solid #00ff00;
      color: #00ff00;
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 2px;
    ">✕</button>
  `;
  
  // Content container
  const content = document.createElement('div');
  content.id = 'debug-panel-content';
  content.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  `;
  
  // Payload viewer
  const payloadSection = document.createElement('div');
  payloadSection.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong>Current Payload:</strong>
      <button id="debug-refresh-payload" style="
        margin-left: 8px;
        background: transparent;
        border: 1px solid #00ff00;
        color: #00ff00;
        cursor: pointer;
        padding: 2px 6px;
        font-size: 10px;
        border-radius: 2px;
      ">🔄 Refresh</button>
      <button id="debug-copy-payload" style="
        margin-left: 4px;
        background: transparent;
        border: 1px solid #00ff00;
        color: #00ff00;
        cursor: pointer;
        padding: 2px 6px;
        font-size: 10px;
        border-radius: 2px;
      ">📋 Copy</button>
    </div>
    <pre id="debug-payload-json" style="
      background: rgba(0, 255, 0, 0.05);
      padding: 8px;
      border: 1px solid rgba(0, 255, 0, 0.3);
      border-radius: 2px;
      max-height: 200px;
      overflow: auto;
      font-size: 10px;
      margin: 0 0 12px 0;
    ">Loading...</pre>
  `;
  
  // Message log
  const logSection = document.createElement('div');
  logSection.innerHTML = `
    <div style="margin-bottom: 8px;">
      <strong>Message Log:</strong>
      <button id="debug-clear-log" style="
        margin-left: 8px;
        background: transparent;
        border: 1px solid #00ff00;
        color: #00ff00;
        cursor: pointer;
        padding: 2px 6px;
        font-size: 10px;
        border-radius: 2px;
      ">🗑️ Clear</button>
    </div>
    <div id="debug-message-log" style="
      background: rgba(0, 255, 0, 0.05);
      padding: 8px;
      border: 1px solid rgba(0, 255, 0, 0.3);
      border-radius: 2px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 10px;
    ">No messages yet</div>
  `;
  
  content.appendChild(payloadSection);
  content.appendChild(logSection);
  
  panelElement.appendChild(header);
  panelElement.appendChild(content);
  
  document.body.appendChild(panelElement);
  
  // Attach button listeners
  document.getElementById('debug-panel-close').addEventListener('click', hidePanel);
  document.getElementById('debug-refresh-payload').addEventListener('click', refreshPayload);
  document.getElementById('debug-copy-payload').addEventListener('click', copyPayload);
  document.getElementById('debug-clear-log').addEventListener('click', clearLog);
  
  // Initial payload load
  refreshPayload();
}

/**
 * Attach keyboard listener for toggle (Ctrl+Shift+D)
 */
function attachToggleListener() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      togglePanel();
    }
  });
}

/**
 * Show panel
 */
export function showPanel() {
  if (panelElement) {
    panelElement.style.display = 'flex';
    isVisible = true;
    refreshPayload();
  }
}

/**
 * Hide panel
 */
export function hidePanel() {
  if (panelElement) {
    panelElement.style.display = 'none';
    isVisible = false;
  }
}

/**
 * Toggle panel visibility
 */
export function togglePanel() {
  if (isVisible) {
    hidePanel();
  } else {
    showPanel();
  }
}

/**
 * Refresh payload display
 */
function refreshPayload() {
  try {
    const payload = getDesignPayloadV1();
    const json = JSON.stringify(payload, null, 2);
    document.getElementById('debug-payload-json').textContent = json;
  } catch (error) {
    document.getElementById('debug-payload-json').textContent = `Error: ${error.message}`;
  }
}

/**
 * Copy payload to clipboard
 */
async function copyPayload() {
  try {
    const payload = getDesignPayloadV1();
    const json = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(json);
    
    // Visual feedback
    const btn = document.getElementById('debug-copy-payload');
    const originalText = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  } catch (error) {
    console.error('[DebugPanel] Copy failed:', error);
  }
}

/**
 * Clear message log
 */
function clearLog() {
  messageLog = [];
  updateLogDisplay();
}

/**
 * Log a message event
 * @param {string} direction - "sent" | "received"
 * @param {string} type - Message type
 * @param {any} payload - Message payload
 */
export function logMessage(direction, type, payload = null) {
  const timestamp = new Date().toLocaleTimeString();
  
  const entry = {
    timestamp,
    direction,
    type,
    payload,
    id: Date.now()
  };
  
  messageLog.unshift(entry); // Add to start
  
  // Keep only last MAX_LOG_ENTRIES
  if (messageLog.length > MAX_LOG_ENTRIES) {
    messageLog = messageLog.slice(0, MAX_LOG_ENTRIES);
  }
  
  updateLogDisplay();
}

/**
 * Update log display
 */
function updateLogDisplay() {
  const logElement = document.getElementById('debug-message-log');
  if (!logElement) return;
  
  if (messageLog.length === 0) {
    logElement.innerHTML = '<div style="color: rgba(0, 255, 0, 0.5);">No messages yet</div>';
    return;
  }
  
  const html = messageLog.map(entry => {
    const directionIcon = entry.direction === 'sent' ? '↑' : '↓';
    const directionColor = entry.direction === 'sent' ? '#00ffff' : '#ffff00';
    
    return `
      <div style="
        margin-bottom: 6px;
        padding: 4px 6px;
        background: rgba(0, 255, 0, 0.03);
        border-left: 2px solid ${directionColor};
      ">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span style="color: ${directionColor};">${directionIcon} ${entry.type}</span>
          <span style="color: rgba(0, 255, 0, 0.5); font-size: 9px;">${entry.timestamp}</span>
        </div>
        ${entry.payload ? `<div style="
          color: rgba(0, 255, 0, 0.7);
          font-size: 9px;
          max-height: 40px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">${JSON.stringify(entry.payload).substring(0, 100)}...</div>` : ''}
      </div>
    `;
  }).join('');
  
  logElement.innerHTML = html;
}

/**
 * Destroy panel
 */
export function destroyDebugPanel() {
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
  }
  messageLog = [];
  isVisible = false;
}
