import { Page, Locator } from '@playwright/test';

export class AdminPage {
  readonly page: Page;
  readonly statsCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statsCards = page.locator('[data-testid="stat-card"], .stat-card');
  }

  async goto() {
    await this.page.goto('/admin');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoLogin() {
    await this.page.goto('/admin/login');
  }

  async gotoStaff() {
    await this.page.goto('/admin/staff');
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
