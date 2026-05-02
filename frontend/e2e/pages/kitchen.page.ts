import { Page, Locator } from '@playwright/test';

export class KitchenPage {
  readonly page: Page;
  readonly orderCards: Locator;
  readonly pauseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.orderCards = page.locator('[data-testid="order-card"], .order-card');
    this.pauseButton = page.locator('button:has-text("Pause"), [data-testid="pause-orders"]');
  }

  async goto() {
    await this.page.goto('/kitchen');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoLogin() {
    await this.page.goto('/kitchen/login');
  }

  async login(username: string, pin: string) {
    await this.gotoLogin();
    const usernameField = this.page.locator('input[placeholder*="username" i], input[name="username"]').first();
    const pinField = this.page.locator('input[type="password"], input[placeholder*="pin" i]').first();
    await usernameField.fill(username);
    await pinField.fill(pin);
    await this.page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first().click();
  }

  async getOrderCount(): Promise<number> {
    return this.orderCards.count();
  }

  async acceptFirstOrder() {
    const acceptBtn = this.page.locator('button:has-text("Accept"), button:has-text("Start"), [data-testid="accept-order"]').first();
    if (await acceptBtn.isVisible({ timeout: 2000 })) {
      await acceptBtn.click();
    }
  }
}
