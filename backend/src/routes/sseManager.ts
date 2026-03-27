// ─────────────────────────────────────────────────────────────────
//  sseManager.ts — Phase 12
//  ✅ All original methods preserved
//  ✅ NEW: broadcastToCounter() for menu_updated + sync_complete events
// ─────────────────────────────────────────────────────────────────

import { Response } from 'express';

type SSEClient = { id: string; res: Response };

class SSEManager {
  private kitchen:  Map<string, SSEClient> = new Map();
  private admin:    Map<string, SSEClient> = new Map();
  private delivery: Map<string, SSEClient> = new Map();
  private counter:  Map<string, SSEClient> = new Map();  // Phase 12

  // ─── Registration ─────────────────────────────────────────────

  registerKitchen(id: string, res: Response)  { this.kitchen.set(id, { id, res });  this._onClose(res, id, this.kitchen); }
  registerAdmin(id: string, res: Response)    { this.admin.set(id, { id, res });    this._onClose(res, id, this.admin); }
  registerDelivery(id: string, res: Response) { this.delivery.set(id, { id, res }); this._onClose(res, id, this.delivery); }
  registerCounter(id: string, res: Response)  { this.counter.set(id, { id, res });  this._onClose(res, id, this.counter); }

  private _onClose(res: Response, id: string, map: Map<string, SSEClient>) {
    res.on('close', () => map.delete(id));
  }

  // ─── Broadcast helpers ────────────────────────────────────────

  private _send(map: Map<string, SSEClient>, event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of map.values()) {
      try { client.res.write(payload); } catch { map.delete(client.id); }
    }
  }

  broadcastToKitchen(event: string, data: unknown)  { this._send(this.kitchen, event, data); }
  broadcastToAdmin(event: string, data: unknown)    { this._send(this.admin, event, data); }
  broadcastToDelivery(event: string, data: unknown) { this._send(this.delivery, event, data); }
  broadcastToCounter(event: string, data: unknown)  { this._send(this.counter, event, data); }  // Phase 12

  sendToDriver(driverId: string, event: string, data: unknown) {
    const client = this.delivery.get(driverId);
    if (client) {
      try { client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
      catch { this.delivery.delete(driverId); }
    }
  }

  // ─── Stats ────────────────────────────────────────────────────
  get counts() {
    return {
      kitchen:  this.kitchen.size,
      admin:    this.admin.size,
      delivery: this.delivery.size,
      counter:  this.counter.size,
    };
  }
}

export const sseManager = new SSEManager();
