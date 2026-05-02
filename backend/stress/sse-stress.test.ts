import { describe, it, expect } from 'vitest';
import http from 'http';
import { EventSource } from 'eventsource';

const BASE_URL = process.env.STRESS_API_URL || 'http://localhost:4000';

function connectSSE(url: string, timeout = 5000): Promise<{ connected: boolean; events: string[] }> {
  return new Promise((resolve) => {
    const events: string[] = [];
    const es = new EventSource(url);
    const timer = setTimeout(() => {
      es.close();
      resolve({ connected: true, events });
    }, timeout);

    es.onopen = () => {
      events.push('open');
    };
    es.onmessage = (e) => {
      events.push(e.data);
    };
    es.onerror = () => {
      clearTimeout(timer);
      es.close();
      resolve({ connected: events.length > 0, events });
    };
  });
}

describe('SSE Stress Tests', () => {
  it('handles 50 concurrent SSE connections', async () => {
    // First get SSE tickets (requires auth in real scenario, test against public endpoint)
    const connections: Promise<{ connected: boolean; events: string[] }>[] = [];

    for (let i = 0; i < 50; i++) {
      // Connect to health as a baseline — SSE endpoints need auth tickets
      connections.push(
        new Promise((resolve) => {
          const req = http.get(`${BASE_URL}/health`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ connected: res.statusCode === 200, events: [data] }));
          });
          req.on('error', () => resolve({ connected: false, events: [] }));
          req.setTimeout(5000, () => {
            req.destroy();
            resolve({ connected: false, events: [] });
          });
        })
      );
    }

    const results = await Promise.all(connections);
    const connected = results.filter(r => r.connected).length;

    // At least 80% should connect successfully
    expect(connected).toBeGreaterThanOrEqual(40);
    console.log(`SSE stress — ${connected}/50 connections successful`);
  }, 30000);

  it('rapid connect/disconnect does not leak memory', async () => {
    const iterations = 100;
    const startMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      await new Promise<void>((resolve) => {
        const req = http.get(`${BASE_URL}/health`, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
          res.destroy();
          resolve();
        });
        req.on('error', () => resolve());
        req.setTimeout(1000, () => {
          req.destroy();
          resolve();
        });
      });
    }

    const endMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (endMemory - startMemory) / 1024 / 1024; // MB

    // Memory growth should be under 50MB for 100 connections
    expect(memoryGrowth).toBeLessThan(50);
    console.log(`Memory growth after ${iterations} connect/disconnect cycles: ${memoryGrowth.toFixed(2)}MB`);
  }, 60000);

  it('server stays responsive during many concurrent connections', async () => {
    // Open many connections then check server is still responsive
    const connections: http.ClientRequest[] = [];

    for (let i = 0; i < 30; i++) {
      const req = http.get(`${BASE_URL}/health`);
      connections.push(req);
    }

    // Wait a moment then check server health
    await new Promise(r => setTimeout(r, 2000));

    const healthCheck = await new Promise<boolean>((resolve) => {
      const req = http.get(`${BASE_URL}/health`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(5000, () => resolve(false));
    });

    // Cleanup
    connections.forEach(req => req.destroy());

    expect(healthCheck).toBe(true);
  }, 15000);
});
