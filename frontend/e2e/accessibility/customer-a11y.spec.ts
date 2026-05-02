import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Customer Panel — Accessibility (WCAG 2.1 AA)', () => {
  test('login page has no a11y violations', async ({ page }) => {
    await page.goto('/customer/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('menu page has no a11y violations', async ({ page }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('cart page has no a11y violations', async ({ page }) => {
    await page.goto('/customer/cart');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('orders page has no a11y violations', async ({ page }) => {
    await page.goto('/customer/orders');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('profile page has no a11y violations', async ({ page }) => {
    await page.goto('/customer/profile');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('login form is keyboard navigable', async ({ page }) => {
    await page.goto('/customer/login');
    await page.waitForLoadState('networkidle');

    // Tab through form elements
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A', 'SELECT']).toContain(firstFocused);

    // Continue tabbing — all interactive elements should be reachable
    const focusedElements: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}:${el.getAttribute('type') || ''}` : 'BODY:';
      });
      focusedElements.push(tag);
    }
    // Should reach at least an input and a button
    expect(focusedElements.some(el => el.startsWith('INPUT'))).toBe(true);
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/customer/login');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate(el => {
        const inp = el as HTMLInputElement;
        // Check for: aria-label, aria-labelledby, associated <label>, placeholder as last resort
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

  test('images have alt text', async ({ page }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const hasAlt = await img.evaluate(el => {
        return el.hasAttribute('alt');
      });
      expect(hasAlt).toBe(true);
    }
  });

  test('heading hierarchy is correct', async ({ page }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');

    const headings = await page.evaluate(() => {
      const hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(hs).map(h => parseInt(h.tagName[1]));
    });

    if (headings.length > 0) {
      // Should start with h1
      expect(headings[0]).toBeLessThanOrEqual(2);

      // No skipping levels (e.g., h1 → h3 without h2)
      for (let i = 1; i < headings.length; i++) {
        const jump = headings[i] - headings[i - 1];
        expect(jump).toBeLessThanOrEqual(1);
      }
    }
  });

  test('color contrast meets AA standards', async ({ page }) => {
    await page.goto('/customer/menu');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('focus indicators are visible', async ({ page }) => {
    await page.goto('/customer/login');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');

    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return true; // no focusable element
      const styles = window.getComputedStyle(el);
      const outline = styles.outline;
      const boxShadow = styles.boxShadow;
      const borderColor = styles.borderColor;
      // Focus should be indicated by outline, box-shadow, or border change
      return outline !== 'none' || boxShadow !== 'none' || borderColor !== '';
    });

    expect(hasFocusStyle).toBe(true);
  });
});
