import { describe, it, expect, vi } from 'vitest';
import { AppError, errorHandler } from '../../middleware/errorHandler';

// Mock logger
vi.mock('../../config/logger', () => ({
  logger: {
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createMockReq(overrides: any = {}) {
  return { path: '/test', method: 'GET', ...overrides } as any;
}

describe('[AppError]', () => {
  it('should create an error with message and status code', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('AppError');
  });

  it('should be an instance of Error', () => {
    const err = new AppError('Test', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('[errorHandler]', () => {
  it('should handle AppError with correct status and message', () => {
    const err = new AppError('Bad request', 400);
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Bad request',
    });
  });

  it('should handle generic Error with 500 status', () => {
    const err = new Error('Something broke');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should hide error details in production for non-AppError', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('secret internal details');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    });
    process.env.NODE_ENV = 'test';
  });

  it('should show error message in non-production for generic errors', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('debug info');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'debug info',
    });
    process.env.NODE_ENV = 'test';
  });
});
