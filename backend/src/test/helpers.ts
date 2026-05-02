import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ── Token helpers ────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-that-is-at-least-32-characters-long';

export function generateTestToken(userId: string, role: string, options?: { expiresIn?: string }): string {
  return jwt.sign(
    { userId, role, jti: crypto.randomUUID() },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: options?.expiresIn ?? '15m' }
  );
}

export function generateExpiredToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role, jti: crypto.randomUUID() },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '0s' }
  );
}

// ── Factory data ─────────────────────────────────────

let idCounter = 0;
function nextId(): string {
  return `test-id-${++idCounter}-${Date.now()}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function buildUser(overrides: Record<string, any> = {}) {
  return {
    id: nextId(),
    name: 'Test Customer',
    mobile: '+923001234567',
    email: null,
    pinHash: '$2b$10$fakePinHashForTesting',
    role: 'customer',
    isVerified: true,
    otpHash: null,
    otpExpiresAt: null,
    otpAttempts: 0,
    otpLastSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildStaff(overrides: Record<string, any> = {}) {
  return {
    id: nextId(),
    username: 'teststaff',
    fullName: 'Test Staff',
    pinHash: '$2b$10$fakePinHashForTesting',
    role: 'kitchen',
    isActive: true,
    verificationStatus: 'VERIFIED',
    driverStatus: 'AVAILABLE',
    activeOrderCount: 0,
    totalDeliveries: 0,
    todayDeliveries: 0,
    liveLat: null,
    liveLng: null,
    codPending: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildMenuItem(overrides: Record<string, any> = {}) {
  return {
    id: nextId(),
    name: 'Test Burger',
    description: 'A test burger',
    basePrice: 500,
    isAvailable: true,
    categoryId: nextId(),
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    modifierGroups: [],
    ...overrides,
  };
}

export function buildOrder(overrides: Record<string, any> = {}) {
  return {
    id: nextId(),
    orderNumber: `CH-${Date.now()}`,
    status: 'pending' as const,
    orderType: 'delivery' as const,
    subtotal: 1000,
    deliveryFee: 100,
    discount: 0,
    total: 1100,
    paymentMethod: 'cash',
    paymentStatus: 'none',
    customerId: nextId(),
    driverId: null,
    cashierId: null,
    deliveryAddress: '123 Test Street',
    deliveryLat: 24.8607,
    deliveryLng: 67.0104,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { id: 'cust-1', name: 'Test Customer', mobile: '+923001234567' },
    driver: null,
    items: [],
    ...overrides,
  };
}

export function buildDeal(overrides: Record<string, any> = {}) {
  return {
    id: nextId(),
    title: 'Test Deal',
    description: '10% off',
    discountType: 'percent',
    discountValue: 10,
    isActive: true,
    validFrom: new Date(Date.now() - 86400000),
    validTo: new Date(Date.now() + 86400000),
    linkedItemIds: [],
    location: 'delivery',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildModifierGroup(overrides: Record<string, any> = {}) {
  return {
    id: nextId(),
    name: 'Size',
    required: false,
    menuItemId: nextId(),
    modifiers: [],
    ...overrides,
  };
}

export function buildModifier(overrides: Record<string, any> = {}) {
  return {
    id: nextId(),
    name: 'Large',
    priceAdjustment: 100,
    isAvailable: true,
    groupId: nextId(),
    ...overrides,
  };
}
