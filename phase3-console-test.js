// PHASE 3 - Console Test Helpers
// Kopiere diese Zeilen in die Browser Console (TOP Context!)

// 1. Check: Sind alle Bridge-Komponenten geladen?
console.log('=== BRIDGE SYSTEM CHECK ===');
console.log('BridgeMessage:', typeof window.BridgeMessage !== 'undefined' ? '✅' : '❌');
console.log('UnbreakBridgeDebug:', typeof window.UnbreakBridgeDebug !== 'undefined' ? '✅' : '❌');
console.log('UnbreakCheckout:', typeof window.UnbreakCheckout !== 'undefined' ? '✅' : '❌');
console.log('createCheckoutFromConfig:', typeof window.UnbreakCheckout?.createCheckoutFromConfig === 'function' ? '✅' : '❌');

// 2. Check: Bridge Debug Stats
if (window.UnbreakBridgeDebug) {
    console.log('\n=== BRIDGE STATS ===');
    const stats = window.UnbreakBridgeDebug.getStats();
    console.log('Messages Received:', stats.messagesReceived);
    console.log('Checkout Triggered:', stats.checkoutTriggered);
    console.log('API Calls Started:', stats.apiCallsStarted);
    console.log('API Calls Succeeded:', stats.apiCallsSucceeded);
    console.log('API Calls Failed:', stats.apiCallsFailed);
    console.log('Redirects:', stats.redirectAttempts);
} else {
    console.log('❌ UnbreakBridgeDebug nicht verfügbar');
}

// 3. Check: iframe Status
console.log('\n=== IFRAME CHECK ===');
const iframe = document.getElementById('configurator-iframe');
console.log('iframe exists:', iframe ? '✅' : '❌');
console.log('iframe src:', iframe?.src || 'N/A');
console.log('iframe loaded:', iframe?._onloadFired ? '✅' : '⏳ waiting...');

// 4. Export Debug Dump (bei Problemen)
// Uncomment wenn benötigt:
// if (window.UnbreakBridgeDebug) {
//     window.UnbreakBridgeDebug.copyDump();
//     console.log('📋 Debug Dump in Clipboard kopiert!');
// }
