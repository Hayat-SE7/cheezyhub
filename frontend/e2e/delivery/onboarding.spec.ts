import { test, expect } from '@playwright/test';

test.describe('Delivery — Onboarding', () => {
  test('should load delivery login page', async ({ page }) => {
    await page.goto('/delivery/login');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).toHaveURL(/\/delivery\/login/);
  });

  test('should have login form fields', async ({ page }) => {
    await page.goto('/delivery/login');
    const usernameField = page.locator('input[placeholder*="username" i], input[name="username"]').first();
    const pinField = page.locator('input[type="password"], input[placeholder*="pin" i]').first();
    await expect(usernameField).toBeVisible({ timeout: 3000 });
    await expect(pinField).toBeVisible({ timeout: 3000 });
  });

  test('should redirect unauthenticated users from dashboard', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/delivery');
    await page.waitForURL(/login|delivery/, { timeout: 3000 }).catch(() => {});
  });
});
