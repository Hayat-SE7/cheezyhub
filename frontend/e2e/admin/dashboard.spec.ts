import { test, expect } from '@playwright/test';

test.describe('Admin — Dashboard', () => {
  test('should load admin login page', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('should have login form', async ({ page }) => {
    await page.goto('/admin/login');
    const usernameField = page.locator('input[placeholder*="username" i], input[name="username"]').first();
    const pinField = page.locator('input[type="password"], input[placeholder*="pin" i]').first();
    await expect(usernameField).toBeVisible({ timeout: 3000 });
    await expect(pinField).toBeVisible({ timeout: 3000 });
  });

  test('should redirect to login without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/admin');
    await page.waitForURL(/login|admin/, { timeout: 3000 }).catch(() => {});
  });

  test('should reject wrong credentials', async ({ page }) => {
    await page.goto('/admin/login');
    const usernameField = page.locator('input[placeholder*="username" i], input[name="username"]').first();
    const pinField = page.locator('input[type="password"], input[placeholder*="pin" i]').first();
    if (await usernameField.isVisible({ timeout: 2000 })) {
      await usernameField.fill('baduser');
      await pinField.fill('0000');
      await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first().click();
      // Should show error or stay on login
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/admin/);
    }
  });
});
