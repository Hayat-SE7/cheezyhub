import { test as base, Page } from '@playwright/test';

const API = process.env.API_URL || 'http://localhost:4000/api';

// Cache tokens across tests to avoid rate limiting
const tokenCache = new Map<string, { token: string; refreshToken: string; user: any }>();

async function loginViaApi(identifier: string, pin: string, role: 'customer' | 'staff'): Promise<{ token: string; refreshToken: string; user: any }> {
  const key = `${role}:${identifier}`;
  if (tokenCache.has(key)) return tokenCache.get(key)!;

  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, pin, role }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed for ${identifier}: ${json.error}`);
  tokenCache.set(key, json.data);
  return json.data;
}

async function injectAuth(page: Page, token: string, refreshToken: string, cookiePrefix: string) {
  const baseURL = process.env.BASE_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  const url = new URL(baseURL);
  await page.context().addCookies([
    { name: `${cookiePrefix}_token`, value: token, domain: url.hostname, path: '/' },
    { name: `${cookiePrefix}_refresh`, value: refreshToken, domain: url.hostname, path: '/' },
  ]);
}

type AuthFixtures = {
  customerPage: Page;
  kitchenPage: Page;
  deliveryPage: Page;
  adminPage: Page;
  counterPage: Page;
  loginAsCustomer: (mobile: string, pin: string) => Promise<void>;
  loginAsStaff: (username: string, pin: string, panel: string) => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  loginAsCustomer: async ({ page }, use) => {
    const fn = async (mobile: string, pin: string) => {
      const data = await loginViaApi(mobile, pin, 'customer');
      await injectAuth(page, data.token, data.refreshToken, 'ch');
    };
    await use(fn);
  },

  loginAsStaff: async ({ page }, use) => {
    const fn = async (username: string, pin: string, panel: string) => {
      const data = await loginViaApi(username, pin, 'staff');
      const prefix = `ch_${panel}`;
      await injectAuth(page, data.token, data.refreshToken, prefix);
    };
    await use(fn);
  },

  customerPage: async ({ page }, use) => {
    // Pre-authenticated customer page (requires CUSTOMER_MOBILE and CUSTOMER_PIN env vars)
    const mobile = process.env.CUSTOMER_MOBILE;
    const pin = process.env.CUSTOMER_PIN;
    if (mobile && pin) {
      const data = await loginViaApi(mobile, pin, 'customer');
      await injectAuth(page, data.token, data.refreshToken, 'ch');
    }
    await use(page);
  },

  kitchenPage: async ({ page }, use) => {
    const username = process.env.KITCHEN_USERNAME;
    const pin = process.env.KITCHEN_PIN;
    if (username && pin) {
      const data = await loginViaApi(username, pin, 'staff');
      await injectAuth(page, data.token, data.refreshToken, 'ch_kitchen');
    }
    await use(page);
  },

  deliveryPage: async ({ page }, use) => {
    const username = process.env.DELIVERY_USERNAME;
    const pin = process.env.DELIVERY_PIN;
    if (username && pin) {
      const data = await loginViaApi(username, pin, 'staff');
      await injectAuth(page, data.token, data.refreshToken, 'ch_delivery');
    }
    await use(page);
  },

  adminPage: async ({ page }, use) => {
    const username = process.env.ADMIN_USERNAME;
    const pin = process.env.ADMIN_PIN;
    if (username && pin) {
      const data = await loginViaApi(username, pin, 'staff');
      await injectAuth(page, data.token, data.refreshToken, 'ch_admin');
    }
    await use(page);
  },

  counterPage: async ({ page }, use) => {
    const username = process.env.COUNTER_USERNAME;
    const pin = process.env.COUNTER_PIN;
    if (username && pin) {
      const data = await loginViaApi(username, pin, 'staff');
      await injectAuth(page, data.token, data.refreshToken, 'ch_counter');
    }
    await use(page);
  },
});

export { expect } from '@playwright/test';
