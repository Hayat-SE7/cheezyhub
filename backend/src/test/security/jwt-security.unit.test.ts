import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET!;

function createMockReq(headers: Record<string, string> = {}) {
  return { headers, query: {}, user: undefined } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('[Security] - JWT Security', () => {
  it('should reject token with tampered payload', () => {
    // Create a valid token, then modify the payload portion
    const token = jwt.sign({ userId: 'user-1', role: 'customer' }, JWT_SECRET, { algorithm: 'HS256' });
    const [header, _payload, signature] = token.split('.');
    // Tamper payload to change role to admin
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'user-1', role: 'admin' })).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    const req = createMockReq({ authorization: `Bearer ${tamperedToken}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject token signed with "none" algorithm', () => {
    // Manually craft a token with alg:none
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 'attacker', role: 'admin' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const req = createMockReq({ authorization: `Bearer ${noneToken}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject token signed with different secret', () => {
    const token = jwt.sign({ userId: 'user-1', role: 'admin' }, 'completely-different-secret-key-abc123', {
      algorithm: 'HS256',
    });

    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject token with missing userId claim', () => {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { algorithm: 'HS256' });

    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    // Token is technically valid JWT, but userId will be undefined
    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBeUndefined();
  });

  it('should reject token with missing role claim', () => {
    const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET, { algorithm: 'HS256' });

    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBeUndefined();
  });

  it('should reject expired token', () => {
    const token = jwt.sign(
      { userId: 'user-1', role: 'admin', exp: Math.floor(Date.now() / 1000) - 100 },
      JWT_SECRET,
      { algorithm: 'HS256' }
    );

    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject completely random string as token', () => {
    const req = createMockReq({ authorization: 'Bearer not-a-jwt-at-all' });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject empty Bearer token', () => {
    const req = createMockReq({ authorization: 'Bearer ' });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('[Security] - Authorization Matrix', () => {

  const routes = [
    { path: '/api/admin/*', allowedRoles: ['admin'] },
    { path: '/api/kitchen/*', allowedRoles: ['kitchen', 'admin'] },
    { path: '/api/delivery/*', allowedRoles: ['delivery', 'admin'] },
    { path: '/api/counter/*', allowedRoles: ['cashier', 'admin'] },
  ];

  const allRoles = ['customer', 'admin', 'kitchen', 'delivery', 'cashier'];

  routes.forEach(({ path, allowedRoles }) => {
    allRoles.forEach((role) => {
      const shouldAllow = allowedRoles.includes(role);
      it(`should ${shouldAllow ? 'allow' : 'deny'} '${role}' on ${path}`, () => {
        const req = { user: { userId: 'u1', role } } as any;
        const res = createMockRes();
        const next = vi.fn();

        requireRole(...allowedRoles)(req, res, next);

        if (shouldAllow) {
          expect(next).toHaveBeenCalled();
        } else {
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
        }
      });
    });
  });
});
