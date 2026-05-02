import { Page, Locator } from '@playwright/test';

export class CounterPage {
  readonly page: Page;
  readonly menuItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.menuItems = page.locator('[data-testid="counter-menu-item"], .menu-item');
  }

  async goto() {
    await this.page.goto('/counter');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoLogin() {
    await this.page.goto('/counter/login');
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
