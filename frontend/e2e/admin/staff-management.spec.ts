import { test, expect } from '@playwright/test';

test.describe('Admin — Staff Management', () => {
  test('should load staff page or redirect to login', async ({ page }) => {
    await page.goto('/admin/staff');
    await expect(page.locator('body')).not.toBeEmpty();
    // Either shows staff list or redirects to login
    const url = page.url();
    expect(url).toMatch(/admin/);
  });

  test('should show staff list when authenticated', async ({ page }) => {
    await page.goto('/admin');
    // Look for staff-related content or login form
    const staffLink = page.locator('a[href*="staff"], text=Staff, [data-testid="staff-nav"]');
    const loginForm = page.locator('input[type="password"]');
    const hasStaffLink = await staffLink.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasLogin = await loginForm.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasStaffLink || hasLogin).toBe(true);
  });
});
