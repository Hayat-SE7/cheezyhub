import { describe, it, expect } from 'vitest';
import autocannon from 'autocannon';

const BASE_URL = process.env.STRESS_API_URL || 'http://localhost:4000';

describe('API Load Tests', () => {
  it('GET /health handles 500 concurrent connections', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/health`,
      connections: 500,
      duration: 10,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.latency.p99).toBeLessThan(2000);
  }, 30000);

  it('GET /api/menu handles 500 concurrent connections under 200ms p95', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/menu`,
      connections: 500,
      duration: 30,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    // p95 should be under 200ms for read-heavy endpoint
    expect(result.latency.p95).toBeLessThan(200);
    console.log(`GET /api/menu — p50: ${result.latency.p50}ms, p95: ${result.latency.p95}ms, p99: ${result.latency.p99}ms, req/s: ${result.requests.average}`);
  }, 60000);

  it('GET /api/menu/categories handles high concurrency', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/menu/categories`,
      connections: 200,
      duration: 15,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.latency.p95).toBeLessThan(300);
    console.log(`GET /api/menu/categories — p95: ${result.latency.p95}ms, req/s: ${result.requests.average}`);
  }, 30000);

  it('GET /api/deals handles moderate load', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/deals`,
      connections: 100,
      duration: 10,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.latency.p95).toBeLessThan(300);
    console.log(`GET /api/deals — p95: ${result.latency.p95}ms, req/s: ${result.requests.average}`);
  }, 30000);
});
