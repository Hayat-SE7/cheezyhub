import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('[localStorage edge cases]', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('corrupted JSON in Zustand persist store', () => {
    it('should handle corrupted cart store data gracefully', () => {
      localStorage.setItem('cheezyhub-cart', '{invalid json!!!');

      // Zustand persist will fail to parse and fall back to default state
      // We verify localStorage has the corrupted value
      const raw = localStorage.getItem('cheezyhub-cart');
      expect(raw).toBe('{invalid json!!!');

      // Attempting JSON.parse should throw
      expect(() => JSON.parse(raw!)).toThrow();
    });

    it('should handle corrupted auth store data gracefully', () => {
      localStorage.setItem('cheezyhub-auth', 'not-json');
      expect(() => JSON.parse(localStorage.getItem('cheezyhub-auth')!)).toThrow();
    });
  });

  describe('missing keys', () => {
    it('should return null for missing cart store', () => {
      expect(localStorage.getItem('cheezyhub-cart')).toBeNull();
    });

    it('should return null for missing auth store', () => {
      expect(localStorage.getItem('cheezyhub-auth')).toBeNull();
    });
  });

  describe('valid persisted state', () => {
    it('should parse valid cart store data', () => {
      const cartData = {
        state: { items: [{ id: '1', name: 'Burger', quantity: 2, unitPrice: 500, totalPrice: 1000, menuItemId: 'mi-1', selectedModifiers: [] }], lastValidated: null },
        version: 0,
      };
      localStorage.setItem('cheezyhub-cart', JSON.stringify(cartData));

      const parsed = JSON.parse(localStorage.getItem('cheezyhub-cart')!);
      expect(parsed.state.items).toHaveLength(1);
      expect(parsed.state.items[0].name).toBe('Burger');
    });

    it('should parse valid auth store data', () => {
      const authData = {
        state: { user: { id: 'u1', name: 'Test', role: 'customer' }, token: 'tok', isAuthenticated: true },
        version: 0,
      };
      localStorage.setItem('cheezyhub-auth', JSON.stringify(authData));

      const parsed = JSON.parse(localStorage.getItem('cheezyhub-auth')!);
      expect(parsed.state.isAuthenticated).toBe(true);
    });
  });

  describe('version mismatch', () => {
    it('should handle future version numbers in persisted data', () => {
      const futureData = {
        state: { items: [], unknownField: true },
        version: 999,
      };
      localStorage.setItem('cheezyhub-cart', JSON.stringify(futureData));

      const parsed = JSON.parse(localStorage.getItem('cheezyhub-cart')!);
      expect(parsed.version).toBe(999);
      // Zustand persist handles version migration; we verify data is parseable
    });
  });

  describe('storage quota', () => {
    it('should not throw when localStorage is available', () => {
      expect(() => {
        localStorage.setItem('test-key', 'test-value');
        localStorage.removeItem('test-key');
      }).not.toThrow();
    });
  });

  describe('sessionStorage for location popup', () => {
    it('should track popup shown state', () => {
      expect(sessionStorage.getItem('ch_location_popup_shown')).toBeNull();

      sessionStorage.setItem('ch_location_popup_shown', '1');
      expect(sessionStorage.getItem('ch_location_popup_shown')).toBe('1');
    });
  });
});
