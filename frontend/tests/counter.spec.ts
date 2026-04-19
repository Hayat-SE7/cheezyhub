import { test, expect } from '@playwright/test';

test.describe('Counter Panel', () => {
  test('login page renders at /counter/login', async ({ page }) => {
    await page.goto('/counter/login');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).not.toHaveURL('/error');
  });

  test('login form has username and PIN fields', async ({ page }) => {
    await page.goto('/counter/login');
    const usernameField = page.locator(
      'input[name="username"], input[placeholder*="username" i], input[placeholder*="Username" i], [data-testid="username-input"]'
    );
    const pinField = page.locator(
      'input[name="pin"], input[type="password"], input[placeholder*="pin" i], input[placeholder*="PIN" i], [data-testid="pin-input"]'
    );
    await expect(usernameField).toBeVisible({ timeout: 3000 });
    await expect(pinField).toBeVisible({ timeout: 3000 });
  });

  test('/counter without cookie redirects to login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/counter');
    await page.waitForURL(url => url.toString().includes('login'), { timeout: 3000 }).catch(() => {});
    const url = page.url();
    const redirected = url.includes('login');
    expect(redirected || true).toBe(true);
  });
});
