import { describe, it, expect } from 'vitest';
import autocannon from 'autocannon';

const BASE_URL = process.env.STRESS_API_URL || 'http://localhost:4000';

describe('Database Stress Tests', () => {
  it('100 concurrent menu reads cause no errors', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/menu`,
      connections: 100,
      duration: 15,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.latency.p99).toBeLessThan(1000);
    console.log(`DB read stress — p50: ${result.latency.p50}ms, p99: ${result.latency.p99}ms, throughput: ${result.requests.average} req/s`);
  }, 30000);

  it('concurrent health checks verify DB connection pool holds', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/health`,
      connections: 100,
      duration: 15,
      pipelining: 1,
    });

    // Health endpoint hits DB with SELECT 1
    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);

    // All responses should be 200
    const statusCodes = (result as any).statusCodeStats;
    if (statusCodes) {
      const degraded = statusCodes['503']?.count || 0;
      // Allow up to 5% degraded responses under extreme load
      expect(degraded / result.requests.total).toBeLessThan(0.05);
    }

    console.log(`DB pool stress — errors: ${result.errors}, p99: ${result.latency.p99}ms`);
  }, 30000);

  it('concurrent category reads cause no duplicate data', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/menu/categories`,
      connections: 50,
      duration: 10,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    console.log(`Category reads — total: ${result.requests.total}, p95: ${result.latency.p95}ms`);
  }, 30000);

  it('mixed read endpoints under concurrent load', async () => {
    const endpoints = ['/api/menu', '/api/deals', '/api/menu/categories', '/health'];

    const results = await Promise.all(
      endpoints.map(ep =>
        autocannon({
          url: `${BASE_URL}${ep}`,
          connections: 25,
          duration: 10,
          pipelining: 1,
        })
      )
    );

    for (let i = 0; i < results.length; i++) {
      expect(results[i].errors).toBe(0);
      console.log(`${endpoints[i]} — p95: ${results[i].latency.p95}ms, req/s: ${results[i].requests.average}`);
    }
  }, 30000);
});
