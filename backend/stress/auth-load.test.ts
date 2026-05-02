import { describe, it, expect } from 'vitest';
import autocannon from 'autocannon';

const BASE_URL = process.env.STRESS_API_URL || 'http://localhost:4000';

describe('Auth Load Tests', () => {
  it('POST /api/auth/login triggers rate limiter under heavy load', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/auth/login`,
      connections: 200,
      duration: 15,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'stress-test@example.com', pin: '1234', role: 'customer' }),
    });

    // Rate limiter should kick in — expect 429s
    const total = result.requests.total;
    const non2xx = result['non2xx'] ?? 0;
    console.log(`POST /api/auth/login — total: ${total}, non-2xx: ${non2xx}, errors: ${result.errors}`);

    // Should have handled all requests without crashes
    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
  }, 30000);

  it('POST /api/auth/send-otp triggers rate limiter', async () => {
    const result = await autocannon({
      url: `${BASE_URL}/api/auth/send-otp`,
      connections: 50,
      duration: 10,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '03001234567' }),
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    console.log(`POST /api/auth/send-otp — total: ${result.requests.total}, p95: ${result.latency.p95}ms`);
  }, 30000);

  it('POST /api/auth/register handles concurrent registrations', async () => {
    let counter = 0;
    const result = await autocannon({
      url: `${BASE_URL}/api/auth/register`,
      connections: 50,
      duration: 10,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      setupClient(client) {
        client.setBody(JSON.stringify({
          name: `StressUser${counter++}`,
          mobile: `0300${String(counter).padStart(7, '0')}`,
          pin: '1234',
        }));
      },
    });

    // No server crashes
    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    console.log(`POST /api/auth/register — total: ${result.requests.total}, p95: ${result.latency.p95}ms`);
  }, 30000);
});
