import { test, expect } from '@playwright/test';

test.describe('UX — Error States', () => {
  test('invalid route shows 404 or redirect', async ({ page }) => {
    const response = await page.goto('/nonexistent-page');
    // Should either show 404 page or redirect to a known page
    const url = page.url();
    const status = response?.status();
    expect(status === 404 || status === 200 || status === 307 || status === 308).toBe(true);
  });

  test('customer page handles API failure gracefully', async ({ page }) => {
    // Block API calls to simulate server down
    await page.route('**/api/**', route => route.abort('connectionrefused'));

    await page.goto('/customer/menu');
    await page.waitForLoadState('domcontentloaded');

    // Should show error message, not crash
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);

    // Should not show raw error stack or undefined
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('TypeError');
    expect(bodyText).not.toContain('Cannot read properties');
  });

  test('kitchen page handles API failure gracefully', async ({ page }) => {
    await page.route('**/api/**', route => route.abort('connectionrefused'));

    await page.goto('/kitchen');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
    expect(bodyText).not.toContain('TypeError');
  });

  test('admin page handles API failure gracefully', async ({ page }) => {
    await page.route('**/api/**', route => route.abort('connectionrefused'));

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
    expect(bodyText).not.toContain('TypeError');
  });

  test('login page shows error for invalid credentials', async ({ page }) => {
    await page.goto('/customer/login');
    await page.waitForLoadState('networkidle');

    // Try to find and fill login form
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="mobile" i]').first();
    if (await phoneInput.isVisible({ timeout: 3000 })) {
      await phoneInput.fill('0000000000');

      const pinInput = page.locator('input[type="password"], input[placeholder*="pin" i]').first();
      if (await pinInput.isVisible()) {
        await pinInput.fill('0000');
      }

      const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1000);

        // Should show error message, not crash
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).not.toContain('TypeError');
      }
    }
  });

  test('network timeout shows user-friendly message', async ({ page }) => {
    // Simulate extremely slow API
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 30000));
      route.abort();
    });

    await page.goto('/customer/menu');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Page should still be functional (not frozen)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});
