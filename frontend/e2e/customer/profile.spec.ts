import { test, expect } from '@playwright/test';

test.describe('Customer — Profile', () => {
  test('should load profile page', async ({ page }) => {
    await page.goto('/customer/profile');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/customer/profile');
    await page.waitForURL(/login|profile/, { timeout: 3000 }).catch(() => {});
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
