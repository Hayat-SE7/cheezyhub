import { test, expect } from '@playwright/test';

test.describe('Advanced — Network Simulation', () => {
  test('should handle slow network gracefully', async ({ page, context }) => {
    // Simulate slow 3G
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024,  // 50 KB/s
      uploadThroughput: 25 * 1024,    // 25 KB/s
      latency: 2000,                  // 2s latency
    });

    await page.goto('/customer/menu', { timeout: 30000 });
    await expect(page.locator('body')).not.toBeEmpty();

    // Reset
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, downloadThroughput: -1, uploadThroughput: -1, latency: 0,
    });
  });

  test('should show content after going offline then online', async ({ page, context }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');

    // Go offline
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, downloadThroughput: 0, uploadThroughput: 0, latency: 0,
    });

    // Page should still show cached content
    await expect(page.locator('body')).not.toBeEmpty();

    // Go back online
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, downloadThroughput: -1, uploadThroughput: -1, latency: 0,
    });

    await page.reload();
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
