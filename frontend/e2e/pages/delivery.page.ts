import { Page, Locator } from '@playwright/test';

export class DeliveryPage {
  readonly page: Page;
  readonly statusToggle: Locator;
  readonly orderCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statusToggle = page.locator('[data-testid="status-toggle"], button:has-text("Online"), button:has-text("Offline")');
    this.orderCards = page.locator('[data-testid="delivery-order"], .order-card');
  }

  async goto() {
    await this.page.goto('/delivery');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoLogin() {
    await this.page.goto('/delivery/login');
  }

  async gotoProfile() {
    await this.page.goto('/delivery/profile');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username: string, pin: string) {
    await this.gotoLogin();
    const usernameField = this.page.locator('input[placeholder*="username" i], input[name="username"]').first();
    const pinField = this.page.locator('input[type="password"], input[placeholder*="pin" i]').first();
    await usernameField.fill(username);
    await pinField.fill(pin);
    await this.page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first().click();
  }
}
