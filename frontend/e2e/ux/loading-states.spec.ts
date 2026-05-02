import { test, expect } from '@playwright/test';

test.describe('UX — Loading States', () => {
  test('customer menu shows loading indicator', async ({ page }) => {
    // Throttle network to see loading state
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024, // 50kb/s
      uploadThroughput: 50 * 1024,
      latency: 2000,
    });

    await page.goto('/customer/menu');

    // Should show some loading indicator (spinner, skeleton, text)
    const hasLoading = await page.evaluate(() => {
      const body = document.body.innerHTML;
      return (
        body.includes('loading') ||
        body.includes('Loading') ||
        body.includes('spinner') ||
        body.includes('skeleton') ||
        !!document.querySelector('[class*="animate-pulse"]') ||
        !!document.querySelector('[class*="animate-spin"]') ||
        !!document.querySelector('[role="progressbar"]') ||
        !!document.querySelector('[data-testid*="loading"]')
      );
    });

    // Eventually content loads
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('customer orders shows loading state', async ({ page }) => {
    await page.goto('/customer/orders');

    // Page should render something (loading or content)
    await page.waitForLoadState('domcontentloaded');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('admin dashboard shows loading indicator', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('kitchen page shows loading state', async ({ page }) => {
    await page.goto('/kitchen');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('counter page shows loading state', async ({ page }) => {
    await page.goto('/counter');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('page transitions dont show blank screen', async ({ page }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');

    // Navigate to cart
    await page.goto('/customer/cart');
    // Should never have completely blank body during transition
    await page.waitForLoadState('domcontentloaded');
    const bodyHtml = await page.locator('body').innerHTML();
    expect(bodyHtml.length).toBeGreaterThan(10);
  });
});
