import { Response } from 'express';

// ─────────────────────────────────────────────
//  SSE Manager  (Phase 12 — complete)
//  Manages Server-Sent Event connections for
//  all panels: customer, kitchen, delivery,
//  counter (cashier/admin).
// ─────────────────────────────────────────────

interface SSEClient {
  id:     string;
  role:   string;
  userId: string;
  res:    Response;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, role: string, userId: string, res: Response): void {
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

    this.sendToClient(id, 'connected', { clientId: id });
  }

  private sendToClient(clientId: string, event: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // ── Kitchen ───────────────────────────────────────────────────
  broadcastToKitchen(event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (client.role === 'kitchen') {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Delivery (broadcast to all drivers) ───────────────────────
  broadcastToDelivery(event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (client.role === 'delivery') {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Send to a specific driver by their staff userId ───────────
  sendToDriver(driverId: string, event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (client.role === 'delivery' && client.userId === driverId) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Customer (send to one specific customer) ──────────────────
  sendToCustomer(customerId: string, event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (client.role === 'customer' && client.userId === customerId) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Admin ─────────────────────────────────────────────────────
  broadcastToAdmin(event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (client.role === 'admin') {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Counter (cashier + admin role clients) ────────────────────
  // Phase 12: used for menu_cache_invalidate broadcasts
  broadcastToCounter(event: string, data: unknown): void {
    this.clients.forEach((client) => {
      if (client.role === 'cashier' || client.role === 'admin') {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });
  }

  // ── Everyone ──────────────────────────────────────────────────
  broadcastAll(event: string, data: unknown): void {
    this.clients.forEach((client) => {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }

  getClientCount(): number { return this.clients.size; }
}

// Singleton
export const sseManager = new SSEManager();
