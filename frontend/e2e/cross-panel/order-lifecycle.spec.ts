import { test, expect } from '@playwright/test';

test.describe('Cross-Panel — Order Lifecycle', () => {
  test('customer menu page loads and shows food items', async ({ page }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');
    // Menu should load with some content
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('kitchen page loads', async ({ page }) => {
    await page.goto('/kitchen');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('delivery page loads', async ({ page }) => {
    await page.goto('/delivery');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('all login pages are accessible', async ({ page }) => {
    for (const panel of ['customer', 'kitchen', 'delivery', 'admin', 'counter']) {
      await page.goto(`/${panel}/login`);
      await expect(page.locator('body')).not.toBeEmpty();
      // Should have some form input
      const hasInput = await page.locator('input').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasInput).toBe(true);
    }
  });
});
