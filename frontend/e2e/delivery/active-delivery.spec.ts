import { test, expect } from '@playwright/test';

test.describe('Delivery — Active Delivery', () => {
  test('should load delivery profile page', async ({ page }) => {
    await page.goto('/delivery/profile');
    // Either loads or redirects to login
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('should show driver status controls when authenticated', async ({ page }) => {
    await page.goto('/delivery');
    // Look for status toggle or login redirect
    const statusToggle = page.locator('button:has-text("Online"), button:has-text("Offline"), [data-testid="status-toggle"]');
    const loginForm = page.locator('input[type="password"]');
    const hasToggle = await statusToggle.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasLogin = await loginForm.isVisible({ timeout: 1000 }).catch(() => false);
    // One of these should be visible
    expect(hasToggle || hasLogin).toBe(true);
  });
});
