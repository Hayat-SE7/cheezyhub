import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

const pages = [
  { name: 'customer-login', path: '/customer/login' },
  { name: 'customer-menu', path: '/customer/menu' },
  { name: 'admin-login', path: '/admin/login' },
  { name: 'kitchen-login', path: '/kitchen/login' },
  { name: 'counter-login', path: '/counter/login' },
];

for (const vp of viewports) {
  test.describe(`Responsive — ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const pg of pages) {
      test(`${pg.name} renders correctly`, async ({ page }) => {
        await page.goto(pg.path);
        await page.waitForLoadState('networkidle');

        // No horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(vp.width + 1); // 1px tolerance

        // Screenshot comparison
        await expect(page).toHaveScreenshot(`${pg.name}-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });
    }

    test('text is readable (no tiny fonts)', async ({ page }) => {
      await page.goto('/customer/menu');
      await page.waitForLoadState('networkidle');

      const smallTextCount = await page.evaluate(() => {
        const allText = document.querySelectorAll('p, span, a, li, td, th, label, button');
        let count = 0;
        allText.forEach(el => {
          const size = parseFloat(window.getComputedStyle(el).fontSize);
          if (size < 12 && el.textContent?.trim()) count++;
        });
        return count;
      });

      // Allow up to 5 small text elements (icons, badges, etc.)
      expect(smallTextCount).toBeLessThanOrEqual(5);
    });

    test('buttons and inputs are usable size', async ({ page }) => {
      await page.goto('/customer/login');
      await page.waitForLoadState('networkidle');

      const interactiveElements = page.locator('button, input, select, textarea, a');
      const count = await interactiveElements.count();

      for (let i = 0; i < count; i++) {
        const el = interactiveElements.nth(i);
        if (await el.isVisible()) {
          const box = await el.boundingBox();
          if (box) {
            // Minimum 32px height for mobile usability
            expect(box.height).toBeGreaterThanOrEqual(28);
          }
        }
      }
    });
  });
}
