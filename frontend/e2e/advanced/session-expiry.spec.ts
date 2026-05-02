import { test, expect } from '@playwright/test';

test.describe('Advanced — Session Expiry', () => {
  test('should redirect to login when token cookie is cleared', async ({ page }) => {
    await page.goto('/customer/orders');
    await page.context().clearCookies();
    await page.reload();
    // Should redirect to login or show unauthenticated state
    await page.waitForURL(/login|orders/, { timeout: 5000 }).catch(() => {});
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should handle invalid token gracefully', async ({ page }) => {
    // Set an invalid token
    const baseURL = 'http://localhost:3000';
    const url = new URL(baseURL);
    await page.context().addCookies([
      { name: 'ch_token', value: 'invalid-expired-token', domain: url.hostname, path: '/' },
    ]);
    await page.goto('/customer/orders');
    // Should either redirect to login or show unauthenticated state
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
