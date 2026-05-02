import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET!;

function createMockReq(headers: Record<string, string> = {}, query: Record<string, string> = {}) {
  return {
    headers,
    query,
    user: undefined,
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('[auth middleware] - authenticate', () => {
  it('should set req.user from valid Bearer token', () => {
    const token = jwt.sign({ userId: 'user-1', role: 'customer' }, JWT_SECRET, { algorithm: 'HS256' });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(expect.objectContaining({ userId: 'user-1', role: 'customer' }));
  });

  it('should accept token from query param (for SSE)', () => {
    const token = jwt.sign({ userId: 'user-2', role: 'kitchen' }, JWT_SECRET, { algorithm: 'HS256' });
    const req = createMockReq({}, { token });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(expect.objectContaining({ userId: 'user-2', role: 'kitchen' }));
  });

  it('should return 401 when no token provided', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'No token provided' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for expired token', () => {
    const token = jwt.sign({ userId: 'user-3', role: 'admin' }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '0s',
    });
    // Wait a tick to ensure expiry
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for token signed with wrong secret', () => {
    const token = jwt.sign({ userId: 'user-4', role: 'admin' }, 'wrong-secret', { algorithm: 'HS256' });
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for malformed token', () => {
    const req = createMockReq({ authorization: 'Bearer not.a.valid.jwt' });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should prefer Authorization header over query param', () => {
    const headerToken = jwt.sign({ userId: 'header-user', role: 'admin' }, JWT_SECRET, { algorithm: 'HS256' });
    const queryToken = jwt.sign({ userId: 'query-user', role: 'customer' }, JWT_SECRET, { algorithm: 'HS256' });
    const req = createMockReq({ authorization: `Bearer ${headerToken}` }, { token: queryToken });
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(req.user.userId).toBe('header-user');
  });
});

describe('[auth middleware] - requireRole', () => {
  it('should call next for matching role', () => {
    const req = createMockReq();
    req.user = { userId: 'u1', role: 'admin' };
    const res = createMockRes();
    const next = vi.fn();

    requireRole('admin')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should accept any of multiple allowed roles', () => {
    const req = createMockReq();
    req.user = { userId: 'u1', role: 'kitchen' };
    const res = createMockRes();
    const next = vi.fn();

    requireRole('admin', 'kitchen')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 for non-matching role', () => {
    const req = createMockReq();
    req.user = { userId: 'u1', role: 'customer' };
    const res = createMockRes();
    const next = vi.fn();

    requireRole('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when no user on request', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    requireRole('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
