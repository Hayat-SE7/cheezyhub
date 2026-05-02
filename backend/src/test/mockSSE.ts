import { vi } from 'vitest';

/**
 * Creates a mock SSE manager that records all broadcasts without
 * actually writing to any HTTP response streams.
 */
export function createMockSSEManager() {
  return {
    broadcastToKitchen: vi.fn(),
    broadcastToDelivery: vi.fn(),
    broadcastToAdmin: vi.fn(),
    broadcastToCounter: vi.fn(),
    broadcastAll: vi.fn(),
    sendToCustomer: vi.fn(),
    sendToDriver: vi.fn(),
    sendToClient: vi.fn(),
    addClient: vi.fn(),
    storeEvent: vi.fn(),
    replayEvents: vi.fn(),
    getClientCount: vi.fn().mockReturnValue(0),
    closeAll: vi.fn(),
    startSweep: vi.fn(),
  };
}

/**
 * Sets up vi.mock for the sseManager singleton.
 * Call this at the top of test files that import modules using sseManager.
 */
export function mockSSEManager() {
  const mock = createMockSSEManager();
  vi.mock('../services/sseManager', () => ({
    sseManager: mock,
  }));
  return mock;
}
