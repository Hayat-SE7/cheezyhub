import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to test SSEManager directly, so we reimport it fresh
// The module-level `sseManager.startSweep()` call needs to be handled
vi.useFakeTimers();

// Re-export the class by importing the module
const { sseManager } = await import('../../services/sseManager');

function createMockResponse() {
  const res: any = {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn().mockReturnValue(true),
    end: vi.fn(),
    on: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('[sseManager]', () => {
  beforeEach(() => {
    // Close all clients between tests
    sseManager.closeAll();
    vi.clearAllMocks();
  });

  describe('addClient', () => {
    it('should add a client and send connected event', () => {
      const res = createMockResponse();
      sseManager.addClient('c1', 'kitchen', 'user-1', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.flushHeaders).toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: connected'));
      expect(sseManager.getClientCount()).toBe(1);
    });

    it('should register close handler for cleanup', () => {
      const res = createMockResponse();
      sseManager.addClient('c1', 'kitchen', 'user-1', res);

      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should replace existing connection for same user+role', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      sseManager.addClient('c1', 'kitchen', 'user-1', res1);
      sseManager.addClient('c2', 'kitchen', 'user-1', res2);

      // Old connection should be ended
      expect(res1.end).toHaveBeenCalled();
      expect(sseManager.getClientCount()).toBe(1);
    });
  });

  describe('broadcastToKitchen', () => {
    it('should send events only to kitchen clients', () => {
      const kitchenRes = createMockResponse();
      const adminRes = createMockResponse();

      sseManager.addClient('c1', 'kitchen', 'u1', kitchenRes);
      sseManager.addClient('c2', 'admin', 'u2', adminRes);

      sseManager.broadcastToKitchen('TEST_EVENT', { test: true });

      // Kitchen gets it (possibly debounced for ORDER_UPDATED)
      // Non-ORDER_UPDATED events are sent immediately
      const kitchenWrites = kitchenRes.write.mock.calls.filter(
        (c: any[]) => c[0].includes('TEST_EVENT')
      );
      expect(kitchenWrites.length).toBe(1);

      const adminWrites = adminRes.write.mock.calls.filter(
        (c: any[]) => c[0].includes('TEST_EVENT')
      );
      expect(adminWrites.length).toBe(0);
    });

    it('should debounce ORDER_UPDATED events per orderId', () => {
      const res = createMockResponse();
      sseManager.addClient('c1', 'kitchen', 'u1', res);

      // Fire 3 rapid ORDER_UPDATED for same orderId
      sseManager.broadcastToKitchen('ORDER_UPDATED', { orderId: 'o1', status: 'pending' });
      sseManager.broadcastToKitchen('ORDER_UPDATED', { orderId: 'o1', status: 'preparing' });
      sseManager.broadcastToKitchen('ORDER_UPDATED', { orderId: 'o1', status: 'ready' });

      // Should not have fired yet (debounced)
      const orderUpdates = res.write.mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('ORDER_UPDATED')
      );
      expect(orderUpdates.length).toBe(0);

      // Advance timers past debounce window (300ms)
      vi.advanceTimersByTime(350);

      const afterDebounce = res.write.mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('ORDER_UPDATED')
      );
      expect(afterDebounce.length).toBe(1); // coalesced into 1
    });
  });

  describe('broadcastToAdmin', () => {
    it('should send events only to admin clients', () => {
      const adminRes = createMockResponse();
      const kitchenRes = createMockResponse();

      sseManager.addClient('c1', 'admin', 'u1', adminRes);
      sseManager.addClient('c2', 'kitchen', 'u2', kitchenRes);

      sseManager.broadcastToAdmin('ADMIN_EVENT', { data: 1 });

      const adminWrites = adminRes.write.mock.calls.filter(
        (c: any[]) => c[0].includes('ADMIN_EVENT')
      );
      expect(adminWrites.length).toBe(1);

      const kitchenWrites = kitchenRes.write.mock.calls.filter(
        (c: any[]) => c[0].includes('ADMIN_EVENT')
      );
      expect(kitchenWrites.length).toBe(0);
    });
  });

  describe('sendToCustomer', () => {
    it('should send events only to the specified customer', () => {
      const cust1 = createMockResponse();
      const cust2 = createMockResponse();

      sseManager.addClient('c1', 'customer', 'cust-1', cust1);
      sseManager.addClient('c2', 'customer', 'cust-2', cust2);

      sseManager.sendToCustomer('cust-1', 'ORDER_UPDATED', { orderId: 'o1' });

      const cust1Writes = cust1.write.mock.calls.filter(
        (c: any[]) => c[0].includes('ORDER_UPDATED')
      );
      const cust2Writes = cust2.write.mock.calls.filter(
        (c: any[]) => c[0].includes('ORDER_UPDATED')
      );
      expect(cust1Writes.length).toBe(1);
      expect(cust2Writes.length).toBe(0);
    });
  });

  describe('sendToDriver', () => {
    it('should send events only to the specified driver', () => {
      const driver1 = createMockResponse();
      const driver2 = createMockResponse();

      sseManager.addClient('c1', 'delivery', 'drv-1', driver1);
      sseManager.addClient('c2', 'delivery', 'drv-2', driver2);

      sseManager.sendToDriver('drv-1', 'NEW_DELIVERY_ASSIGNED', { orderId: 'o1' });

      const drv1Writes = driver1.write.mock.calls.filter(
        (c: any[]) => c[0].includes('NEW_DELIVERY_ASSIGNED')
      );
      const drv2Writes = driver2.write.mock.calls.filter(
        (c: any[]) => c[0].includes('NEW_DELIVERY_ASSIGNED')
      );
      expect(drv1Writes.length).toBe(1);
      expect(drv2Writes.length).toBe(0);
    });
  });

  describe('broadcastAll', () => {
    it('should send to all connected clients', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const res3 = createMockResponse();

      sseManager.addClient('c1', 'kitchen', 'u1', res1);
      sseManager.addClient('c2', 'admin', 'u2', res2);
      sseManager.addClient('c3', 'customer', 'u3', res3);

      sseManager.broadcastAll('SYSTEM_EVENT', { msg: 'hello' });

      [res1, res2, res3].forEach(res => {
        const writes = res.write.mock.calls.filter(
          (c: any[]) => c[0].includes('SYSTEM_EVENT')
        );
        expect(writes.length).toBe(1);
      });
    });
  });

  describe('event buffer and replay', () => {
    it('should replay missed events on reconnect with lastEventId', () => {
      const res1 = createMockResponse();
      sseManager.addClient('c1', 'admin', 'u1', res1);

      // Fire some events to build buffer
      sseManager.broadcastToAdmin('EVENT_A', { a: 1 });
      sseManager.broadcastToAdmin('EVENT_B', { b: 2 });

      // Get the current sequence from the connected event
      const connectedWrite = res1.write.mock.calls.find(
        (c: any[]) => c[0].includes('event: connected')
      );
      // Extract seq from the connected event
      const seqMatch = connectedWrite?.[0]?.match(/"seq":(\d+)/);
      const connectedSeq = seqMatch ? seqMatch[1] : '0';

      // Simulate reconnect with lastEventId = seq at connect time
      const res2 = createMockResponse();
      sseManager.addClient('c2', 'admin', 'u1', res2, connectedSeq);

      // Should have received replayed events after the connected event
      const replayWrites = res2.write.mock.calls.filter(
        (c: any[]) => c[0].includes('EVENT_A') || c[0].includes('EVENT_B')
      );
      expect(replayWrites.length).toBe(2);
    });
  });

  describe('closeAll', () => {
    it('should end all connections and clear client map', () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();

      sseManager.addClient('c1', 'kitchen', 'u1', res1);
      sseManager.addClient('c2', 'admin', 'u2', res2);

      sseManager.closeAll();

      expect(res1.end).toHaveBeenCalled();
      expect(res2.end).toHaveBeenCalled();
      expect(sseManager.getClientCount()).toBe(0);
    });
  });
});
