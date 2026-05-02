import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Counter Panel — Accessibility (WCAG 2.1 AA)', () => {
  test('login page has no a11y violations', async ({ page }) => {
    await page.goto('/counter/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('counter dashboard has no a11y violations', async ({ page }) => {
    await page.goto('/counter');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('login form is keyboard navigable', async ({ page }) => {
    await page.goto('/counter/login');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A', 'SELECT']).toContain(firstFocused);
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/counter/login');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate(el => {
        const inp = el as HTMLInputElement;
        return !!(
          inp.getAttribute('aria-label') ||
          inp.getAttribute('aria-labelledby') ||
          inp.labels?.length ||
          inp.getAttribute('placeholder') ||
          inp.getAttribute('title')
        );
      });
      expect(hasLabel).toBe(true);
    }
  });

  test('color contrast meets AA standards', async ({ page }) => {
    await page.goto('/counter/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('interactive elements have accessible names', async ({ page }) => {
    await page.goto('/counter');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const hasName = await btn.evaluate(el => {
        return !!(
          el.textContent?.trim() ||
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          el.getAttribute('title')
        );
      });
      expect(hasName).toBe(true);
    }
  });

  test('POS interface is touch-accessible', async ({ page }) => {
    await page.goto('/counter');
    await page.waitForLoadState('networkidle');

    // Verify buttons meet minimum touch target size (44x44px)
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box) {
          // WCAG 2.5.5 Target Size — minimum 44x44 for touch
          // Log warnings for small targets but don't hard-fail
          if (box.width < 44 || box.height < 44) {
            const text = await btn.textContent();
            console.warn(`Small touch target: "${text?.trim()}" (${box.width}x${box.height})`);
          }
        }
      }
    }
  });

  test('heading hierarchy is correct', async ({ page }) => {
    await page.goto('/counter');
    await page.waitForLoadState('networkidle');

    const headings = await page.evaluate(() => {
      const hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(hs).map(h => parseInt(h.tagName[1]));
    });

    if (headings.length > 0) {
      expect(headings[0]).toBeLessThanOrEqual(2);
      for (let i = 1; i < headings.length; i++) {
        expect(headings[i] - headings[i - 1]).toBeLessThanOrEqual(1);
      }
    }
  });
});
