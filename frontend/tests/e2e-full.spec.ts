import { test, expect, Page } from '@playwright/test';

// ─── Token Cache (avoid rate limiting) ─────────────────────

const API = 'http://localhost:4000/api';
const tokenCache = new Map<string, { token: string; refreshToken: string; user: any }>();

async function staffLoginApi(identifier: string, pin: string) {
  const key = `staff:${identifier}`;
  if (tokenCache.has(key)) return tokenCache.get(key)!;
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, pin, role: 'staff' }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  tokenCache.set(key, json.data);
  return json.data;
}

async function customerLoginApi(mobile: string, pin: string) {
  const key = `cust:${mobile}`;
  if (tokenCache.has(key)) return tokenCache.get(key)!;
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: mobile, pin, role: 'customer' }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  tokenCache.set(key, json.data);
  return json.data;
}

async function injectStaffAuth(page: Page, panel: string, identifier: string, pin: string) {
  const data = await staffLoginApi(identifier, pin);
  const cookie = panel === 'admin' ? 'ch_admin_token' :
                 panel === 'counter' ? 'ch_counter_token' :
                 panel === 'kitchen' ? 'ch_kitchen_token' :
                 'ch_delivery_token';
  const refreshCookie = cookie.replace('_token', '_refresh');
  await page.context().addCookies([
    { name: cookie, value: data.token, domain: 'localhost', path: '/' },
    { name: refreshCookie, value: data.refreshToken, domain: 'localhost', path: '/' },
  ]);
  return data;
}

// ═══════════════════════════════════════════════════════════
//  1. BACKEND API HEALTH & AUTH
// ═══════════════════════════════════════════════════════════

test.describe('Backend API', () => {
  test('health endpoint returns ok + db connected', async ({ request }) => {
    const res = await request.get('http://localhost:4000/health');
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
  });

  test('staff login with valid credentials returns token', async ({ request }) => {
    const data = await staffLoginApi('admin', '1234');
    expect(data.token).toBeTruthy();
    expect(data.user.role).toBe('admin');
  });

  test('staff login with wrong PIN returns 401', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { identifier: 'admin', pin: '9999', role: 'staff' },
    });
    expect(res.status()).toBe(401);
  });

  test('customer login with valid credentials returns token', async () => {
    const data = await customerLoginApi('+923000000000', '1234');
    expect(data.token).toBeTruthy();
    expect(data.user.role).toBe('customer');
  });

  test('menu endpoint returns categories with items', async ({ request }) => {
    const res = await request.get(`${API}/menu`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    const burgers = body.data.find((c: any) => c.name === 'Burgers');
    expect(burgers).toBeTruthy();
    expect(burgers.items.length).toBeGreaterThan(0);
  });

  test('protected endpoint without token returns 401', async ({ request }) => {
    const res = await request.get(`${API}/orders`);
    expect(res.status()).toBe(401);
  });

  test('admin settings endpoint returns system settings', async ({ request }) => {
    const { token } = await staffLoginApi('admin', '1234');
    const res = await request.get(`${API}/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.restaurantName).toBeTruthy();
    expect(typeof body.data.deliveryFee).toBe('number');
  });

  test('admin stats endpoint returns dashboard data', async ({ request }) => {
    const { token } = await staffLoginApi('admin', '1234');
    const res = await request.get(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.totalOrders).toBe('number');
    expect(typeof body.data.totalRevenue).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════
//  2. ADMIN PANEL — Browser Login + Dashboard
// ═══════════════════════════════════════════════════════════

test.describe('Admin Panel (Browser)', () => {
  test('login page renders with username and PIN fields', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('input[placeholder*="Admin username" i]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('text=Admin Panel')).toBeVisible();
  });

  test('successful login redirects to /admin', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('input[placeholder*="username" i]').fill('admin');
    await page.locator('input[type="password"]').fill('1234');
    await page.locator('button:has-text("Access System")').click();
    await page.waitForURL('**/admin', { timeout: 10000 });
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('dashboard loads via auth cookie injection', async ({ page }) => {
    await injectStaffAuth(page, 'admin', 'admin', '1234');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin');
  });
});

// ═══════════════════════════════════════════════════════════
//  3. ADMIN STAFF CRUD (API)
// ═══════════════════════════════════════════════════════════

test.describe('Admin Staff CRUD (API)', () => {
  let adminToken: string;
  let createdStaffId: string;

  test.beforeAll(async () => {
    adminToken = (await staffLoginApi('admin', '1234')).token;
  });

  test('create a new staff member', async ({ request }) => {
    const res = await request.post(`${API}/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `test_staff_${Date.now()}`, pin: '5555', role: 'kitchen', fullName: 'Test Kitchen Staff' },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('kitchen');
    createdStaffId = body.data.id;
  });

  test('list staff includes newly created member', async ({ request }) => {
    const res = await request.get(`${API}/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    const found = body.data.find((s: any) => s.id === createdStaffId);
    expect(found).toBeTruthy();
  });

  test('patch staff to deactivate', async ({ request }) => {
    const res = await request.patch(`${API}/admin/staff/${createdStaffId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { isActive: false },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(false);
  });

  test('delete the test staff member', async ({ request }) => {
    const res = await request.delete(`${API}/admin/staff/${createdStaffId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. KITCHEN PANEL
// ═══════════════════════════════════════════════════════════

test.describe('Kitchen Panel', () => {
  test('login page renders at /kitchen/login', async ({ page }) => {
    await page.goto('/kitchen/login');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).not.toHaveURL('/error');
  });

  test('kitchen dashboard loads after auth', async ({ page }) => {
    await injectStaffAuth(page, 'kitchen', 'kitchen1', '5678');
    await page.goto('/kitchen');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/kitchen');
  });
});

// ═══════════════════════════════════════════════════════════
//  5. COUNTER PANEL — Login + POS + Shift + Order
// ═══════════════════════════════════════════════════════════

test.describe('Counter Panel', () => {
  test('login page renders with two-step flow', async ({ page }) => {
    await page.goto('/counter/login');
    await expect(page.locator('input[placeholder*="cashier" i]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Continue')).toBeVisible();
  });

  test('step 1 to step 2 shows PIN pad', async ({ page }) => {
    await page.goto('/counter/login');
    await page.locator('input[placeholder*="cashier" i]').fill('cashier1');
    await page.locator('button:has-text("Continue")').click();
    await expect(page.locator('text=Enter PIN')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('button:has-text("1")').first()).toBeVisible();
  });

  test('counter dashboard loads after auth', async ({ page }) => {
    await injectStaffAuth(page, 'counter', 'cashier1', '000000');
    await page.goto('/counter');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/counter');
  });

  test('counter shift + order lifecycle via API', async ({ request }) => {
    const { token } = await staffLoginApi('cashier1', '000000');

    // End any existing open shift
    await request.post(`${API}/counter/shift/end`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { closingCash: 0 },
    }).catch(() => {});

    // Start a new shift
    const startRes = await request.post(`${API}/counter/shift/start`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { openingFloat: 5000 },
    });
    const startBody = await startRes.json();
    expect(startBody.success).toBe(true);
    expect(startBody.data.status).toBe('open');

    // Get menu
    const menuRes = await request.get(`${API}/counter/menu`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const menu = await menuRes.json();
    const firstItem = menu.data[0]?.items?.[0];
    expect(firstItem).toBeTruthy();

    // Place a counter order
    const orderRes = await request.post(`${API}/counter/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        items: [{ menuItemId: firstItem.id, quantity: 2, selectedModifierIds: [] }],
        paymentMethod: 'cash',
        customerNote: 'E2E test order',
      },
    });
    const orderBody = await orderRes.json();
    if (!orderBody.success) console.error('Counter order failed:', JSON.stringify(orderBody));
    expect(orderBody.success).toBe(true);
    expect(orderBody.data.orderNumber).toBeTruthy();
    expect(orderBody.data.orderType).toBe('counter');
    expect(orderBody.data.total).toBeGreaterThan(0);
    // BUG 4 FIX: shiftId should be set
    expect(orderBody.data.shiftId).toBeTruthy();

    // End the shift
    const endRes = await request.post(`${API}/counter/shift/end`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { closingCash: 5000, notes: 'E2E test shift end' },
    });
    const endBody = await endRes.json();
    expect(endBody.success).toBe(true);
    expect(endBody.data.status).toBe('closed');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. DELIVERY PANEL
// ═══════════════════════════════════════════════════════════

test.describe('Delivery Panel', () => {
  test('login page renders at /delivery/login', async ({ page }) => {
    await page.goto('/delivery/login');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('delivery dashboard loads after auth', async ({ page }) => {
    await injectStaffAuth(page, 'delivery', 'driver1', '9012');
    await page.goto('/delivery');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/delivery');
  });

  test('driver profile + status toggle + earnings via API', async ({ request }) => {
    const { token } = await staffLoginApi('driver1', '9012');

    // Profile
    const profileRes = await request.get(`${API}/delivery/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await profileRes.json();
    expect(profile.success).toBe(true);
    expect(profile.data.username).toBe('driver1');
    expect(profile.data.verificationStatus).toBe('VERIFIED');

    // Toggle to AVAILABLE
    const res1 = await request.patch(`${API}/delivery/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'AVAILABLE' },
    });
    expect((await res1.json()).data.driverStatus).toBe('AVAILABLE');

    // Toggle back to OFFLINE
    const res2 = await request.patch(`${API}/delivery/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'OFFLINE' },
    });
    expect((await res2.json()).data.driverStatus).toBe('OFFLINE');

    // Earnings
    const earningsRes = await request.get(`${API}/delivery/earnings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const earnings = await earningsRes.json();
    expect(earnings.success).toBe(true);
    expect(typeof earnings.data.todayDeliveries).toBe('number');
    expect(typeof earnings.data.codPending).toBe('number');

    // COD wallet
    const codRes = await request.get(`${API}/delivery/cod`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const cod = await codRes.json();
    expect(cod.success).toBe(true);
    expect(typeof cod.data.wallet.codPending).toBe('number');
    expect(Array.isArray(cod.data.recentCODOrders)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  7. CUSTOMER PANEL
// ═══════════════════════════════════════════════════════════

test.describe('Customer Panel', () => {
  test('customer menu page loads', async ({ page }) => {
    await page.goto('/customer');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('customer login page renders', async ({ page }) => {
    await page.goto('/customer/login');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).not.toHaveURL('/error');
  });

  test('customer order placement + history via API', async ({ request }) => {
    const { token } = await customerLoginApi('+923000000000', '1234');

    // Get menu
    const menuRes = await request.get(`${API}/menu`);
    const menu = await menuRes.json();
    const item = menu.data[0]?.items?.[0];
    expect(item).toBeTruthy();

    // Place order
    const orderRes = await request.post(`${API}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        items: [{ menuItemId: item.id, quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '123 Test Street, Lahore',
        deliveryLat: 31.5204,
        deliveryLng: 74.3587,
        notes: 'E2E test delivery order',
      },
    });
    const orderBody = await orderRes.json();
    if (!orderBody.success) console.error('Customer order failed:', JSON.stringify(orderBody));
    expect(orderBody.success).toBe(true);
    expect(orderBody.data.orderType).toBe('delivery');
    expect(orderBody.data.status).toBe('pending');
    expect(orderBody.data.orderNumber).toMatch(/^CH-/);

    // View history
    const historyRes = await request.get(`${API}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const history = await historyRes.json();
    expect(history.success).toBe(true);
    expect(history.data.total).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  8. ORDER LIFECYCLE — Full Flow
// ═══════════════════════════════════════════════════════════

test.describe('Order Lifecycle (API)', () => {
  let adminToken: string;
  let kitchenToken: string;
  let driverToken: string;
  let customerToken: string;
  let orderId: string;

  test.beforeAll(async () => {
    adminToken = (await staffLoginApi('admin', '1234')).token;
    kitchenToken = (await staffLoginApi('kitchen1', '5678')).token;
    driverToken = (await staffLoginApi('driver1', '9012')).token;
    customerToken = (await customerLoginApi('+923000000000', '1234')).token;
  });

  test('step 1: customer places delivery order', async ({ request }) => {
    const menuRes = await request.get(`${API}/menu`);
    const menu = await menuRes.json();
    const item = menu.data[0]?.items?.[0];
    if (!item) { test.skip(); return; }

    const res = await request.post(`${API}/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
      data: {
        items: [{ menuItemId: item.id, quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '456 Lifecycle Test Street',
        notes: 'lifecycle test',
      },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
    orderId = body.data.id;
  });

  test('step 2: kitchen moves to preparing', async ({ request }) => {
    if (!orderId) { test.skip(); return; }
    const res = await request.patch(`${API}/kitchen/orders/${orderId}/status`, {
      headers: { Authorization: `Bearer ${kitchenToken}` },
      data: { status: 'preparing' },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('preparing');
  });

  test('step 3: kitchen marks ready', async ({ request }) => {
    if (!orderId) { test.skip(); return; }
    const res = await request.patch(`${API}/kitchen/orders/${orderId}/status`, {
      headers: { Authorization: `Bearer ${kitchenToken}` },
      data: { status: 'ready' },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ready');
  });

  test('step 4: admin assigns driver', async ({ request }) => {
    if (!orderId) { test.skip(); return; }
    await new Promise((r) => setTimeout(r, 2000));

    // Check if auto-assigned
    const orderRes = await request.get(`${API}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const order = await orderRes.json();
    if (order.data.status === 'assigned') {
      expect(order.data.driverId).toBeTruthy();
      return;
    }

    // Set driver available
    await request.patch(`${API}/delivery/status`, {
      headers: { Authorization: `Bearer ${driverToken}` },
      data: { status: 'AVAILABLE' },
    });

    const staffRes = await request.get(`${API}/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const staff = await staffRes.json();
    const driver = staff.data.find((s: any) => s.role === 'delivery');
    if (!driver) { test.skip(); return; }

    const res = await request.patch(`${API}/admin/orders/${orderId}/assign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { driverId: driver.id },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('step 5: driver picks up', async ({ request }) => {
    if (!orderId) { test.skip(); return; }
    const res = await request.patch(`${API}/delivery/orders/${orderId}/status`, {
      headers: { Authorization: `Bearer ${driverToken}` },
      data: { status: 'picked_up' },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('picked_up');
  });

  test('step 6: driver delivers (auto-completes)', async ({ request }) => {
    if (!orderId) { test.skip(); return; }
    const res = await request.patch(`${API}/delivery/orders/${orderId}/status`, {
      headers: { Authorization: `Bearer ${driverToken}` },
      data: { status: 'delivered' },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('completed');
  });

  test('step 7: order shows completed in customer history', async ({ request }) => {
    if (!orderId) { test.skip(); return; }
    const res = await request.get(`${API}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════
//  9. BUG FIX VERIFICATIONS
// ═══════════════════════════════════════════════════════════

test.describe('Bug Fix Verifications', () => {
  test('BUG 2: freeDeliveryThreshold applied on backend', async ({ request }) => {
    const { token: adminToken } = await staffLoginApi('admin', '1234');
    const { token: custToken } = await customerLoginApi('+923000000000', '1234');

    // Set a low threshold
    await request.patch(`${API}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { freeDeliveryThreshold: 500, deliveryFee: 150 },
    });

    // Get an item priced >= 500
    const menuRes = await request.get(`${API}/menu`);
    const menu = await menuRes.json();
    let item: any = null;
    for (const cat of menu.data) {
      for (const i of cat.items) {
        if (i.basePrice >= 500) { item = i; break; }
      }
      if (item) break;
    }
    if (!item) { test.skip(); return; }

    // Place order
    const res = await request.post(`${API}/orders`, {
      headers: { Authorization: `Bearer ${custToken}` },
      data: {
        items: [{ menuItemId: item.id, quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: 'Free delivery test address',
      },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.deliveryFee).toBe(0);

    // Reset
    await request.patch(`${API}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { freeDeliveryThreshold: 0 },
    });
  });

  test('BUG 5: staff delete with orders returns friendly error', async ({ request }) => {
    const { token: adminToken } = await staffLoginApi('admin', '1234');

    const staffRes = await request.get(`${API}/admin/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const staff = await staffRes.json();
    const cashier = staff.data.find((s: any) => s.username === 'cashier1');
    if (!cashier) { test.skip(); return; }

    const res = await request.delete(`${API}/admin/staff/${cashier.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();
    if (res.status() === 409) {
      expect(body.error).toContain('Cannot delete');
    } else {
      expect(body.success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  10. AUTH EDGE CASES
// ═══════════════════════════════════════════════════════════

test.describe('Auth Edge Cases', () => {
  test('/auth/me returns correct user data', async ({ request }) => {
    const { token } = await staffLoginApi('admin', '1234');
    const res = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.username).toBe('admin');
    expect(body.data.role).toBe('admin');
  });
});

// ═══════════════════════════════════════════════════════════
//  11. DEALS CRUD (API)
// ═══════════════════════════════════════════════════════════

test.describe('Deals CRUD (API)', () => {
  let adminToken: string;
  let dealId: string;

  test.beforeAll(async () => {
    adminToken = (await staffLoginApi('admin', '1234')).token;
  });

  test('create, list, toggle, delete a deal', async ({ request }) => {
    // Create
    const createRes = await request.post(`${API}/admin/deals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'E2E Test Deal',
        description: 'Test description',
        dealType: 'promotion',
        discountType: 'flat',
        discountValue: 100,
        displayLocation: 'both',
        isActive: true,
      },
    });
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    dealId = createBody.data.id;

    // List
    const listRes = await request.get(`${API}/admin/deals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listBody = await listRes.json();
    expect(listBody.data.find((d: any) => d.id === dealId)).toBeTruthy();

    // Toggle
    const toggleRes = await request.patch(`${API}/admin/deals/${dealId}/toggle`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect((await toggleRes.json()).data.isActive).toBe(false);

    // Delete
    const delRes = await request.delete(`${API}/admin/deals/${dealId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect((await delRes.json()).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  12. ADDRESS CRUD (API)
// ═══════════════════════════════════════════════════════════

test.describe('Address CRUD (API)', () => {
  test('create, list, delete an address', async ({ request }) => {
    const { token } = await customerLoginApi('+923000000000', '1234');

    // Create
    const createRes = await request.post(`${API}/addresses`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        label: 'E2E Home',
        type: 'home',
        addressText: '999 E2E Test Avenue, Lahore',
        latitude: 31.52,
        longitude: 74.35,
        isDefault: true,
      },
    });
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    const addressId = createBody.data.id;

    // List
    const listRes = await request.get(`${API}/addresses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listRes.json();
    expect(listBody.data.find((a: any) => a.id === addressId)).toBeTruthy();

    // Delete
    const delRes = await request.delete(`${API}/addresses/${addressId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await delRes.json()).success).toBe(true);
  });
});
