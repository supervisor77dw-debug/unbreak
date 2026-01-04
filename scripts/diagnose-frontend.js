/**
 * Diagnose: Check if configurator.js is loading and running
 */

// This should run in browser console on configurator.html

console.log('=== DIAGNOSTICS START ===');

// 1. Check if scripts loaded
console.log('1. Scripts loaded?');
console.log('   window.UnbreakCheckout:', typeof window.UnbreakCheckout);
console.log('   window.UnbreakCheckoutState:', typeof window.UnbreakCheckoutState);
console.log('   window.UnbreakTrace:', typeof window.UnbreakTrace);

// 2. Check if button exists
console.log('2. Button exists?');
const btn = document.getElementById('configurator-buy-now-btn');
console.log('   Button element:', btn ? 'YES' : 'NO');
if (btn) {
  console.log('   Button visible:', btn.offsetParent !== null);
  console.log('   Button styles:', {
    display: getComputedStyle(btn).display,
    visibility: getComputedStyle(btn).visibility,
    opacity: getComputedStyle(btn).opacity
  });
}

// 3. Check if event listeners attached
console.log('3. Event listeners?');
console.log('   Button has click listener:', btn?.dataset?.bound === '1');

// 4. Check last config
console.log('4. Last config?');
console.log('   Config:', window.UnbreakCheckoutState?.lastConfig);

// 5. Check for JavaScript errors
console.log('5. Check error event listeners');
window.addEventListener('error', (e) => {
  console.error('❌ CAUGHT ERROR:', e.message, e.filename, e.lineno);
});

console.log('=== DIAGNOSTICS END ===');
console.log('Copy this output and send to developer');
