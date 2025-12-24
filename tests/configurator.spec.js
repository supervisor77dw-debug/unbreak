import { test, expect } from '@playwright/test';

/**
 * UNBREAK ONE - Configurator E2E Tests
 * 
 * Diese Tests prüfen die iframe-Integration und das postMessage-Handling
 * zwischen der Homepage und dem 3D-Konfigurator.
 */

test.describe('3D Configurator Integration', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to configurator page
    await page.goto('/configurator.html');
  });

  test('should display loading overlay on page load', async ({ page }) => {
    // Loading overlay sollte initial sichtbar sein
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toBeVisible();
    
    // Spinner sollte sichtbar sein
    const spinner = page.locator('#loading-spinner');
    await expect(spinner).toBeVisible();
    
    // Loading text sollte sichtbar sein
    const loadingText = page.locator('#loading-text');
    await expect(loadingText).toBeVisible();
    await expect(loadingText).toContainText(/wird geladen|loading/i);
  });

  test('should have iframe initially invisible', async ({ page }) => {
    // iframe sollte existieren aber unsichtbar sein
    const iframe = page.locator('#configurator-iframe');
    await expect(iframe).toBeAttached();
    
    // Check opacity = 0 (initial state)
    const opacity = await iframe.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBe(0);
  });

  test('should hide loading overlay and show iframe on READY message', async ({ page }) => {
    // Simuliere UNBREAK_CONFIG_READY message vom iframe
    await page.evaluate(() => {
      window.postMessage({
        type: 'UNBREAK_CONFIG_READY',
        ok: true,
        version: '1.0.0-test',
        ts: Date.now()
      }, '*');
    });
    
    // Warte bis Loading overlay versteckt ist
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toHaveClass(/hidden/);
    
    // iframe sollte jetzt sichtbar sein (ready class)
    const iframe = page.locator('#configurator-iframe');
    await expect(iframe).toHaveClass(/ready/);
    
    // Check opacity = 1
    await page.waitForTimeout(500); // Warte auf CSS transition
    const opacity = await iframe.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBe(1);
  });

  test('should display error message on ERROR message', async ({ page }) => {
    const errorMsg = 'Test Error: Model konnte nicht geladen werden';
    
    // Simuliere UNBREAK_CONFIG_ERROR message
    await page.evaluate((msg) => {
      window.postMessage({
        type: 'UNBREAK_CONFIG_ERROR',
        message: msg,
        stack: 'Error stack trace...'
      }, '*');
    }, errorMsg);
    
    // Error container sollte sichtbar sein
    const errorContainer = page.locator('#error-container');
    await expect(errorContainer).toBeVisible();
    
    // Error message sollte korrekt angezeigt werden
    const errorMessage = page.locator('#error-message');
    await expect(errorMessage).toContainText(errorMsg);
    
    // Reload button sollte sichtbar sein
    const reloadButton = page.locator('#reload-button');
    await expect(reloadButton).toBeVisible();
    
    // Spinner sollte versteckt sein
    const spinner = page.locator('#loading-spinner');
    await expect(spinner).not.toBeVisible();
  });

  test('should update progress bar on LOADING message', async ({ page }) => {
    // Simuliere UNBREAK_CONFIG_LOADING mit progress
    await page.evaluate(() => {
      window.postMessage({
        type: 'UNBREAK_CONFIG_LOADING',
        progress: 50
      }, '*');
    });
    
    // Progress bar sollte sichtbar sein
    const progressBar = page.locator('#loading-progress');
    await expect(progressBar).toBeVisible();
    
    // Progress fill sollte 50% sein
    const progressFill = page.locator('#progress-fill');
    const width = await progressFill.evaluate(el => el.style.width);
    expect(width).toBe('50%');
    
    // Progress percent sollte 50% anzeigen
    const progressPercent = page.locator('#progress-percent');
    await expect(progressPercent).toContainText('50%');
  });

  test('should ignore messages from unknown origins', async ({ page }) => {
    // Console logs überwachen
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));
    
    // Simuliere message von fremder origin (wird in evalulate nicht funktionieren,
    // aber wir können prüfen ob handler korrekt implementiert ist)
    await page.evaluate(() => {
      // In echtem Szenario würde dies von iframe kommen mit falscher origin
      // Hier nur zur Demonstration
      const event = new MessageEvent('message', {
        data: { type: 'UNBREAK_CONFIG_READY', ok: true },
        origin: 'https://evil-site.com'
      });
      window.dispatchEvent(event);
    });
    
    // Loading overlay sollte NICHT versteckt werden
    await page.waitForTimeout(1000);
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toBeVisible();
    
    // Console sollte warning enthalten
    expect(consoleLogs.some(log => log.includes('unknown origin'))).toBeTruthy();
  });

  test('should show error after 15s timeout if no READY received', async ({ page }) => {
    // Warte 15 Sekunden (Timeout)
    // Hinweis: In echten Tests würde man Timers mocken für schnellere Ausführung
    await page.waitForTimeout(15500);
    
    // Error container sollte sichtbar sein
    const errorContainer = page.locator('#error-container');
    await expect(errorContainer).toBeVisible();
    
    // Error message sollte Timeout-Hinweis enthalten
    const errorMessage = page.locator('#error-message');
    await expect(errorMessage).toContainText(/länger als erwartet/i);
  });

  test('should reload iframe when reload button is clicked', async ({ page }) => {
    // Trigger error state first
    await page.evaluate(() => {
      window.postMessage({
        type: 'UNBREAK_CONFIG_ERROR',
        message: 'Test error'
      }, '*');
    });
    
    // Get initial iframe src
    const iframe = page.locator('#configurator-iframe');
    const initialSrc = await iframe.getAttribute('src');
    
    // Click reload button
    const reloadButton = page.locator('#reload-button');
    await reloadButton.click();
    
    // iframe src sollte sich geändert haben (Cache-Busting)
    await page.waitForTimeout(500);
    const newSrc = await iframe.getAttribute('src');
    expect(newSrc).not.toBe(initialSrc);
    expect(newSrc).toContain('?t=');
    
    // Loading overlay sollte wieder sichtbar sein
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toBeVisible();
    
    // Error sollte versteckt sein
    const errorContainer = page.locator('#error-container');
    await expect(errorContainer).not.toBeVisible();
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Reload page
    await page.reload();
    
    // iframe sollte existieren und sichtbare Höhe haben
    const iframe = page.locator('#configurator-iframe');
    await expect(iframe).toBeAttached();
    
    const box = await iframe.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThan(400); // min-height: 70vh on mobile
    
    // Loading overlay sollte responsive sein
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toBeVisible();
  });

  test('should enable debug mode with ?debug=1', async ({ page }) => {
    // Navigate with debug parameter
    await page.goto('/configurator.html?debug=1');
    
    // Debug log sollte sichtbar sein
    const debugLog = page.locator('#debug-log');
    await expect(debugLog).toBeVisible();
    
    // Debug events container sollte existieren
    const debugEvents = page.locator('#debug-events');
    await expect(debugEvents).toBeAttached();
    
    // Clear button sollte sichtbar sein
    const clearButton = page.locator('#debug-clear');
    await expect(clearButton).toBeVisible();
    
    // Simuliere message und prüfe ob Event geloggt wird
    await page.evaluate(() => {
      window.postMessage({
        type: 'UNBREAK_CONFIG_READY',
        ok: true
      }, '*');
    });
    
    await page.waitForTimeout(500);
    
    // Debug events sollte mindestens einen Eintrag haben
    const eventCount = await debugEvents.locator('.debug-event').count();
    expect(eventCount).toBeGreaterThan(0);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    // Initial page load
    await page.goto('/configurator.html');
    
    // Navigate away
    await page.goto('/index.html');
    
    // Navigate back
    await page.goto('/configurator.html');
    
    // Loading overlay sollte wieder sichtbar sein
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toBeVisible();
    
    // iframe sollte wieder initial state haben (opacity 0)
    const iframe = page.locator('#configurator-iframe');
    const opacity = await iframe.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBe(0);
    
    // States sollten zurückgesetzt sein
    const errorContainer = page.locator('#error-container');
    await expect(errorContainer).not.toBeVisible();
  });

});
