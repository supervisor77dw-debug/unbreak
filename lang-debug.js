// QUICK FIX: Language Sync Debug + Bypass Validation
// Füge dieses Script in configurator.html ein (TEMPORÄR zum Debuggen)

console.log('🔧 [LANG-DEBUG] Installing message interceptor...');

// Intercept ALL postMessages
const originalAddEventListener = window.addEventListener;
window.addEventListener = function(type, listener, ...args) {
    if (type === 'message') {
        const wrappedListener = function(event) {
            // Log ALL messages
            console.log('📩 [MESSAGE-RAW]', {
                origin: event.origin,
                data: event.data,
                type: event.data?.type || event.data?.event,
                isLanguageRelated: JSON.stringify(event.data).toLowerCase().includes('lang')
            });
            
            // Call original listener
            return listener.call(this, event);
        };
        return originalAddEventListener.call(this, type, wrappedListener, ...args);
    }
    return originalAddEventListener.call(this, type, listener, ...args);
};

// Manual language send (bypass validation)
window.sendLanguageManual = function(lang) {
    const iframe = document.getElementById('configurator-iframe');
    if (!iframe) {
        console.error('iframe not found');
        return;
    }
    
    // Try multiple formats
    const formats = [
        // Bridge v2.0 format
        {
            event: 'UNBREAK_SET_LOCALE',
            schemaVersion: '1.0',
            correlationId: 'manual_' + Date.now(),
            timestamp: new Date().toISOString(),
            payload: { locale: lang }
        },
        // Legacy format 1
        {
            type: 'UNBREAK_SET_LANG',
            lang: lang,
            source: 'parent'
        },
        // Legacy format 2
        {
            type: 'setLanguage',
            language: lang
        },
        // Simple format
        {
            action: 'changeLanguage',
            lang: lang
        }
    ];
    
    const targetOrigin = 'https://unbreak-3-d-konfigurator.vercel.app';
    
    formats.forEach((msg, i) => {
        console.log(`📤 [SEND-${i+1}]`, msg);
        iframe.contentWindow.postMessage(msg, targetOrigin);
    });
    
    console.log('✅ Sent all format variants to iframe');
};

console.log('✅ [LANG-DEBUG] Ready. Use: sendLanguageManual("de") or sendLanguageManual("en")');
