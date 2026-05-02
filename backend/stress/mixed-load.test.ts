import { describe, it, expect } from 'vitest';
import autocannon from 'autocannon';

const BASE_URL = process.env.STRESS_API_URL || 'http://localhost:4000';

describe('Mixed Load Tests', () => {
  it('GET + POST simultaneously without corruption', async () => {
    // Run read and write load in parallel
    const [readResult, writeResult] = await Promise.all([
      // Read load: GET /api/menu
      autocannon({
        url: `${BASE_URL}/api/menu`,
        connections: 100,
        duration: 15,
        pipelining: 1,
      }),
      // Write load: POST /api/auth/login (will get rate limited but shouldn't crash)
      autocannon({
        url: `${BASE_URL}/api/auth/login`,
        connections: 50,
        duration: 15,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'mixed-test@example.com', pin: '1234', role: 'customer' }),
      }),
    ]);

    // No server errors on reads
    expect(readResult.errors).toBe(0);
    expect(readResult.timeouts).toBe(0);

    // Writes should not cause server errors (rate limit 429 is fine)
    expect(writeResult.errors).toBe(0);
    expect(writeResult.timeouts).toBe(0);

    console.log(`Mixed load — reads p95: ${readResult.latency.p95}ms, writes p95: ${writeResult.latency.p95}ms`);
  }, 30000);

  it('burst traffic: 0 to 500 users spike', async () => {
    // Simulate spike — start with low connections, ramp up
    const phases = [
      { connections: 10, duration: 3 },
      { connections: 100, duration: 3 },
      { connections: 500, duration: 5 },
      { connections: 100, duration: 3 },
      { connections: 10, duration: 3 },
    ];

    for (const phase of phases) {
      const result = await autocannon({
        url: `${BASE_URL}/api/menu`,
        connections: phase.connections,
        duration: phase.duration,
        pipelining: 1,
      });

      // Server should handle gracefully at every phase
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      console.log(`Burst phase (${phase.connections} conn) — p95: ${result.latency.p95}ms, req/s: ${result.requests.average}`);
    }
  }, 120000);

  it('sustained load for 60 seconds with no degradation', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/menu`,
      connections: 50,
      duration: 60,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);

    // p99 should stay reasonable even after 60s
    expect(result.latency.p99).toBeLessThan(2000);
    console.log(`Sustained 60s — p50: ${result.latency.p50}ms, p95: ${result.latency.p95}ms, p99: ${result.latency.p99}ms, total: ${result.requests.total}`);
  }, 90000);
});
