import { test, expect } from '@playwright/test';

test.describe('Customer Panel — Visual Regression', () => {
  test('login page screenshot', async ({ page }) => {
    await page.goto('/customer/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('customer-login.png', { maxDiffPixelRatio: 0.01 });
  });

  test('menu page screenshot', async ({ page }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('customer-menu.png', { maxDiffPixelRatio: 0.01 });
  });

  test('cart page screenshot', async ({ page }) => {
    await page.goto('/customer/cart');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('customer-cart.png', { maxDiffPixelRatio: 0.01 });
  });

  test('orders page screenshot', async ({ page }) => {
    await page.goto('/customer/orders');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('customer-orders.png', { maxDiffPixelRatio: 0.01 });
  });

  test('admin login page screenshot', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('admin-login.png', { maxDiffPixelRatio: 0.01 });
  });

  test('kitchen login page screenshot', async ({ page }) => {
    await page.goto('/kitchen/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('kitchen-login.png', { maxDiffPixelRatio: 0.01 });
  });

  test('delivery login page screenshot', async ({ page }) => {
    await page.goto('/delivery/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('delivery-login.png', { maxDiffPixelRatio: 0.01 });
  });

  test('counter login page screenshot', async ({ page }) => {
    await page.goto('/counter/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('counter-login.png', { maxDiffPixelRatio: 0.01 });
  });
});
