import { Response } from 'express';

// ─────────────────────────────────────────────
//  SSE Manager  (Phase 12 — with catch-up)
//  Manages Server-Sent Event connections for
//  all panels: customer, kitchen, delivery,
//  counter (cashier/admin).
//
//  Features:
//    - Per-role connection limits (DoS protection)
//    - Sequence IDs for catch-up on reconnect
//    - Debounced broadcasts for rapid updates
//    - Dead connection sweep
// ─────────────────────────────────────────────

interface SSEClient {
  id:     string;
  role:   string;
  userId: string;
  res:    Response;
}

interface StoredEvent {
  seq:   number;
  event: string;
  data:  unknown;
  ts:    number;
  // Target filters
  role?:     string;
  userId?:   string;
}

// Max connections per role to prevent resource exhaustion
const MAX_CONNECTIONS_PER_ROLE = parseInt(process.env.SSE_MAX_PER_ROLE ?? '50');
// How many events to buffer for catch-up (per role channel)
const EVENT_BUFFER_SIZE = 200;
// How long to keep events for catch-up (5 minutes)
const EVENT_TTL_MS = 5 * 60_000;

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  // Event buffer for catch-up on reconnect
  private eventBuffer: StoredEvent[] = [];
  private seqCounter = 0;

  /**
   * Debounced broadcast — coalesces rapid events for the same key
   * into a single emission after `ms` of silence.
   */
  private debouncedBroadcast(
    key: string,
    ms: number,
    fn: () => void
  ): void {
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(key, setTimeout(() => {
      this.debounceTimers.delete(key);
      fn();
    }, ms));
  }

  /**
   * Store event in buffer for catch-up replay.
   */
  private storeEvent(event: string, data: unknown, filter?: { role?: string; userId?: string }): number {
    const seq = ++this.seqCounter;
    this.eventBuffer.push({
      seq,
      event,
      data,
      ts: Date.now(),
      role: filter?.role,
      userId: filter?.userId,
    });

    // Trim old events
    const cutoff = Date.now() - EVENT_TTL_MS;
    while (this.eventBuffer.length > EVENT_BUFFER_SIZE || (this.eventBuffer.length > 0 && this.eventBuffer[0].ts < cutoff)) {
      this.eventBuffer.shift();
    }

    return seq;
  }

  /**
   * Replay missed events to a client since a given sequence number.
   */
  private replayEvents(clientId: string, lastSeq: number): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const missed = this.eventBuffer.filter((e) => {
      if (e.seq <= lastSeq) return false;
      // Match target: global events or targeted to this role/user
      if (e.role && e.role !== client.role) return false;
      if (e.userId && e.userId !== client.userId) return false;
      return true;
    });

    for (const e of missed) {
      client.res.write(`id: ${e.seq}\nevent: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
    }
  }

  addClient(id: string, role: string, userId: string, res: Response, lastEventId?: string): void {
    // Connection limit per role
    let roleCount = 0;
    this.clients.forEach((existing) => {
      if (existing.role === role) roleCount++;
    });
    if (roleCount >= MAX_CONNECTIONS_PER_ROLE) {
      res.status(503).end('Too many SSE connections');
      return;
    }

    // Clean up stale connections for the same user+role
    this.clients.forEach((existing, key) => {
      if (existing.userId === userId && existing.role === role && key !== id) {
        existing.res.end();
        this.clients.delete(key);
      }
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeat = setInterval(() => { res.write(': ping\n\n'); }, 30000);
    const client: SSEClient = { id, role, userId, res };
    this.clients.set(id, client);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.clients.delete(id);
    });

    this.sendToClient(id, 'connected', { clientId: id, seq: this.seqCounter });

    // Replay missed events if client provides Last-Event-ID
    if (lastEventId) {
      const lastSeq = parseInt(lastEventId, 10);
      if (!isNaN(lastSeq)) {
        this.replayEvents(id, lastSeq);
      }
    }
  }

  private sendToClient(clientId: string, event: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.res.write(`id: ${this.seqCounter}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // ── Kitchen ───────────────────────────────────────────────────
  broadcastToKitchen(event: string, data: unknown): void {
    const seq = this.storeEvent(event, data, { role: 'kitchen' });
    const payload = data as any;
    // Debounce ORDER_UPDATED per orderId (300ms) to prevent flooding during rapid transitions
    if (event === 'ORDER_UPDATED' && payload?.orderId) {
      this.debouncedBroadcast(`kitchen:${payload.orderId}`, 300, () => {
        this.clients.forEach((client) => {
          if (client.role === 'kitchen') {
            client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          }
        });
      });
      return;
    }
    this.clients.forEach((client) => {
      if (client.role === 'kitchen') {
        client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Delivery (broadcast to all drivers) ───────────────────────
  broadcastToDelivery(event: string, data: unknown): void {
    const seq = this.storeEvent(event, data, { role: 'delivery' });
    this.clients.forEach((client) => {
      if (client.role === 'delivery') {
        client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Send to a specific driver by their staff userId ───────────
  sendToDriver(driverId: string, event: string, data: unknown): void {
    const seq = this.storeEvent(event, data, { role: 'delivery', userId: driverId });
    this.clients.forEach((client) => {
      if (client.role === 'delivery' && client.userId === driverId) {
        client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Customer (send to one specific customer) ──────────────────
  sendToCustomer(customerId: string, event: string, data: unknown): void {
    const seq = this.storeEvent(event, data, { role: 'customer', userId: customerId });
    this.clients.forEach((client) => {
      if (client.role === 'customer' && client.userId === customerId) {
        client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Admin ─────────────────────────────────────────────────────
  broadcastToAdmin(event: string, data: unknown): void {
    const seq = this.storeEvent(event, data, { role: 'admin' });
    this.clients.forEach((client) => {
      if (client.role === 'admin') {
        client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Counter (cashier + admin role clients) ────────────────────
  broadcastToCounter(event: string, data: unknown): void {
    const seq = this.storeEvent(event, data);
    this.clients.forEach((client) => {
      if (client.role === 'cashier' || client.role === 'admin') {
        client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Everyone ──────────────────────────────────────────────────
  broadcastAll(event: string, data: unknown): void {
    const seq = this.storeEvent(event, data);
    this.clients.forEach((client) => {
      client.res.write(`id: ${seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }

  /** Periodic sweep to detect dead connections whose 'close' event never fired */
  startSweep(): void {
    setInterval(() => {
      this.clients.forEach((client, key) => {
        try {
          const ok = client.res.write(': sweep\n\n');
          if (!ok) {
            client.res.end();
            this.clients.delete(key);
          }
        } catch {
          this.clients.delete(key);
        }
      });
    }, 60_000);
  }

  getClientCount(): number { return this.clients.size; }

  closeAll(): void {
    this.clients.forEach((client) => {
      client.res.end();
    });
    this.clients.clear();
  }
}

// Singleton
export const sseManager = new SSEManager();
sseManager.startSweep();
