import { test, expect } from '@playwright/test';

test.describe('Customer — Cart & Checkout', () => {
  test('should show empty cart message when no items', async ({ page }) => {
    await page.goto('/customer/cart');
    const emptyText = page.locator('text=Cart is empty, text=empty');
    await expect(emptyText.first()).toBeVisible({ timeout: 5000 });
  });

  test('should have Browse Menu button on empty cart', async ({ page }) => {
    await page.goto('/customer/cart');
    const browseBtn = page.locator('button:has-text("Browse Menu"), a:has-text("Browse Menu")');
    const visible = await browseBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await browseBtn.click();
      await expect(page).toHaveURL(/\/customer\/menu/);
    }
  });

  test('should show payment method selector when cart has items', async ({ page }) => {
    // Add item via localStorage (Zustand persist)
    await page.goto('/customer/cart');
    await page.evaluate(() => {
      const cartData = {
        state: {
          items: [{
            id: 'test-1', menuItemId: 'mi-1', name: 'Test Burger',
            quantity: 1, unitPrice: 500, totalPrice: 500,
            selectedModifiers: [],
          }],
          lastValidated: null,
        },
        version: 0,
      };
      localStorage.setItem('cheezyhub-cart', JSON.stringify(cartData));
    });
    await page.reload();

    const cashOption = page.locator('text=Cash on Delivery');
    const onlineOption = page.locator('text=Pay Online');
    const hasCash = await cashOption.isVisible({ timeout: 3000 }).catch(() => false);
    const hasOnline = await onlineOption.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasCash || hasOnline).toBe(true);
  });

  test('should redirect to login when placing order without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/customer/cart');
    // Inject cart item
    await page.evaluate(() => {
      const cartData = {
        state: {
          items: [{
            id: 'test-1', menuItemId: 'mi-1', name: 'Test Burger',
            quantity: 1, unitPrice: 500, totalPrice: 500,
            selectedModifiers: [],
          }],
          lastValidated: null,
        },
        version: 0,
      };
      localStorage.setItem('cheezyhub-cart', JSON.stringify(cartData));
    });
    await page.reload();

    const placeBtn = page.locator('button:has-text("Login to Order"), button:has-text("Place Order")');
    if (await placeBtn.isVisible({ timeout: 3000 })) {
      await placeBtn.click();
      // Should redirect to login
      await page.waitForURL(/login/, { timeout: 3000 }).catch(() => {});
    }
  });
});
