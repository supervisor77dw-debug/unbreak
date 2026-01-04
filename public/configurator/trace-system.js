/**
 * UNBREAK ONE - E2E TRACE SYSTEM
 * Correlation ID tracking through entire checkout flow
 * 
 * Flow:
 * 1. User clicks "Add to Cart" or "Buy Now" → Generate trace_id
 * 2. Config sent to server with trace_id
 * 3. Order draft created with trace_id
 * 4. Stripe session created with trace_id in metadata
 * 5. Webhook receives event with trace_id
 * 6. Customer/Order updated with trace_id
 * 7. Admin shows trace_id for debugging
 */

(function() {
    'use strict';
    
    // Global trace storage
    window.UNBREAK_TRACE = window.UNBREAK_TRACE || {
        current_trace_id: null,
        logs: [],
        config_snapshots: {}
    };
    
    /**
     * Generate new trace ID
     */
    function generateTraceId() {
        // Use crypto.randomUUID() if available, otherwise fallback
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback UUID v4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Log trace event
     */
    function logTrace(eventType, data, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const trace_id = window.UNBREAK_TRACE.current_trace_id;
        
        const logEntry = {
            timestamp,
            trace_id,
            event_type: eventType,
            level,
            data: JSON.parse(JSON.stringify(data)) // Deep clone
        };
        
        window.UNBREAK_TRACE.logs.push(logEntry);
        
        // Console output with color coding
        const styles = {
            'INFO': 'color: #2563eb; font-weight: bold',
            'SUCCESS': 'color: #16a34a; font-weight: bold',
            'WARNING': 'color: #ea580c; font-weight: bold',
            'ERROR': 'color: #dc2626; font-weight: bold'
        };
        
        console.log(
            `%c[TRACE] ${eventType}`,
            styles[level] || styles.INFO,
            {
                trace_id,
                timestamp,
                ...data
            }
        );
        
        // Store in sessionStorage for persistence
        try {
            const recentLogs = window.UNBREAK_TRACE.logs.slice(-50); // Keep last 50
            sessionStorage.setItem('unbreak_trace_logs', JSON.stringify(recentLogs));
            sessionStorage.setItem('unbreak_current_trace_id', trace_id || '');
        } catch (e) {
            console.warn('Could not persist trace logs:', e);
        }
    }
    
    /**
     * Start new trace
     */
    function startTrace(context = 'checkout') {
        const trace_id = generateTraceId();
        window.UNBREAK_TRACE.current_trace_id = trace_id;
        
        logTrace('TRACE_START', {
            context,
            user_agent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer
        }, 'INFO');
        
        return trace_id;
    }
    
    /**
     * Log configuration snapshot
     */
    function logConfigSnapshot(config, eventName = 'CONFIG_SNAPSHOT') {
        const trace_id = window.UNBREAK_TRACE.current_trace_id;
        
        if (!trace_id) {
            console.warn('[TRACE] No active trace - starting new one');
            startTrace('config');
        }
        
        // Store snapshot
        window.UNBREAK_TRACE.config_snapshots[eventName] = {
            timestamp: new Date().toISOString(),
            config: JSON.parse(JSON.stringify(config))
        };
        
        // Extract color summary for debugging
        const colorSummary = {};
        if (config.colors) {
            Object.keys(config.colors).forEach(area => {
                colorSummary[area] = config.colors[area];
            });
        }
        
        logTrace(eventName, {
            config_summary: {
                product: config.product || config.productType,
                finish: config.finish,
                variant: config.variant,
                colors: colorSummary,
                has_preview_image: !!config.previewImageUrl,
                has_bom: !!config.bom
            },
            full_config_size: JSON.stringify(config).length
        }, 'INFO');
        
        return config;
    }
    
    /**
     * Log color change
     */
    function logColorChange(areaKey, colorValue, fullConfig) {
        const trace_id = window.UNBREAK_TRACE.current_trace_id;
        
        logTrace('CONFIG_COLOR_CHANGE', {
            area: areaKey,
            color: colorValue,
            all_colors: fullConfig.colors || {}
        }, 'INFO');
    }
    
    /**
     * Export trace logs for debugging
     */
    function exportTraceLogs(trace_id = null) {
        const logsToExport = trace_id 
            ? window.UNBREAK_TRACE.logs.filter(log => log.trace_id === trace_id)
            : window.UNBREAK_TRACE.logs;
        
        const exportData = {
            export_timestamp: new Date().toISOString(),
            trace_id: trace_id || 'all',
            total_events: logsToExport.length,
            logs: logsToExport,
            config_snapshots: window.UNBREAK_TRACE.config_snapshots
        };
        
        // Create downloadable file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unbreak-trace-${trace_id || 'all'}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📥 Trace logs exported:', exportData);
        return exportData;
    }
    
    /**
     * Get current trace ID
     */
    function getCurrentTraceId() {
        return window.UNBREAK_TRACE.current_trace_id;
    }
    
    /**
     * Load trace logs from sessionStorage
     */
    function loadTraceLogs() {
        try {
            const stored = sessionStorage.getItem('unbreak_trace_logs');
            const trace_id = sessionStorage.getItem('unbreak_current_trace_id');
            
            if (stored) {
                window.UNBREAK_TRACE.logs = JSON.parse(stored);
            }
            
            if (trace_id) {
                window.UNBREAK_TRACE.current_trace_id = trace_id;
            }
        } catch (e) {
            console.warn('Could not load trace logs:', e);
        }
    }
    
    // Load existing logs on init
    loadTraceLogs();
    
    // Export API
    window.UnbreakTrace = {
        start: startTrace,
        log: logTrace,
        logConfig: logConfigSnapshot,
        logColorChange: logColorChange,
        export: exportTraceLogs,
        getCurrentId: getCurrentTraceId,
        getLogs: () => window.UNBREAK_TRACE.logs,
        getSnapshots: () => window.UNBREAK_TRACE.config_snapshots
    };
    
    // Add debug UI if in debug mode
    if (new URLSearchParams(window.location.search).get('trace') === '1') {
        document.addEventListener('DOMContentLoaded', () => {
            createTraceDebugUI();
        });
    }
    
    function createTraceDebugUI() {
        const debugUI = document.createElement('div');
        debugUI.id = 'trace-debug-ui';
        debugUI.innerHTML = `
            <style>
                #trace-debug-ui {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.9);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    max-width: 400px;
                    max-height: 500px;
                    overflow-y: auto;
                    z-index: 999999;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                #trace-debug-ui h3 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    color: #60a5fa;
                }
                #trace-debug-ui button {
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 5px;
                    font-size: 11px;
                }
                #trace-debug-ui button:hover {
                    background: #1d4ed8;
                }
                .trace-event {
                    padding: 5px;
                    margin: 3px 0;
                    border-left: 3px solid #2563eb;
                    background: rgba(37, 99, 235, 0.1);
                    font-size: 11px;
                }
                .trace-event.error {
                    border-left-color: #dc2626;
                    background: rgba(220, 38, 38, 0.1);
                }
                .trace-event.success {
                    border-left-color: #16a34a;
                    background: rgba(22, 163, 74, 0.1);
                }
            </style>
            <h3>🔍 Trace Debug</h3>
            <div><strong>Trace ID:</strong> <span id="current-trace-id">-</span></div>
            <div style="margin: 10px 0;">
                <button onclick="window.UnbreakTrace.export()">Export Logs</button>
                <button onclick="window.UNBREAK_TRACE.logs = []; document.getElementById('trace-events').innerHTML = '';">Clear</button>
            </div>
            <div id="trace-events"></div>
        `;
        document.body.appendChild(debugUI);
        
        // Update trace ID display
        const updateTraceId = () => {
            const el = document.getElementById('current-trace-id');
            if (el) {
                el.textContent = window.UNBREAK_TRACE.current_trace_id || 'none';
            }
        };
        
        setInterval(updateTraceId, 500);
        updateTraceId();
        
        // Update events display
        const updateEvents = () => {
            const container = document.getElementById('trace-events');
            if (!container) return;
            
            const recentLogs = window.UNBREAK_TRACE.logs.slice(-10);
            container.innerHTML = recentLogs.map(log => `
                <div class="trace-event ${log.level.toLowerCase()}">
                    <strong>${log.event_type}</strong><br>
                    ${log.timestamp.split('T')[1].split('.')[0]}
                </div>
            `).join('');
        };
        
        setInterval(updateEvents, 1000);
    }
    
    console.log('✅ UNBREAK Trace System loaded');
    console.log('   Start trace: UnbreakTrace.start()');
    console.log('   Export logs: UnbreakTrace.export()');
    console.log('   Debug UI: Add ?trace=1 to URL');
    
})();
