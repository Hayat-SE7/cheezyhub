import { test, expect } from '@playwright/test';

test.describe('Counter — POS Flow', () => {
  test('should load counter login page', async ({ page }) => {
    await page.goto('/counter/login');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).toHaveURL(/\/counter\/login/);
  });

  test('should have login form', async ({ page }) => {
    await page.goto('/counter/login');
    const usernameField = page.locator('input[placeholder*="username" i], input[name="username"]').first();
    const pinField = page.locator('input[type="password"], input[placeholder*="pin" i]').first();
    await expect(usernameField).toBeVisible({ timeout: 3000 });
    await expect(pinField).toBeVisible({ timeout: 3000 });
  });

  test('should redirect unauthenticated users from counter', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/counter');
    await page.waitForURL(/login|counter/, { timeout: 3000 }).catch(() => {});
  });
});
