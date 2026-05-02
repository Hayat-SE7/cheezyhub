import { Page, Locator, expect } from '@playwright/test';

export class CustomerPage {
  readonly page: Page;
  readonly menuSearch: Locator;
  readonly cartLink: Locator;
  readonly cartCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.menuSearch = page.locator('input[placeholder*="Search"]');
    this.cartLink = page.locator('a[href*="/cart"], [data-testid="cart-link"]');
    this.cartCount = page.locator('[data-testid="cart-count"]');
  }

  async gotoMenu() {
    await this.page.goto('/customer/menu');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoCart() {
    await this.page.goto('/customer/cart');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoOrders() {
    await this.page.goto('/customer/orders');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoProfile() {
    await this.page.goto('/customer/profile');
    await this.page.waitForLoadState('networkidle');
  }

  async searchMenu(query: string) {
    await this.menuSearch.fill(query);
  }

  async clickFirstMenuItem() {
    const item = this.page.locator('[data-testid="menu-item"]').first();
    if (await item.isVisible({ timeout: 3000 })) {
      await item.click();
    }
  }

  async getMenuItemCount(): Promise<number> {
    return this.page.locator('[data-testid="menu-item"]').count();
  }

  async getCartItemCount(): Promise<number> {
    const text = await this.cartCount.textContent().catch(() => '0');
    return parseInt(text || '0', 10);
  }
}
