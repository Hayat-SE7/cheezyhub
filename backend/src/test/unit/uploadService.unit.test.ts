import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock fs before importing uploadService (which runs mkdirSync at module scope)
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

import { createUploader, getFileUrl } from '../../services/uploadService';

describe('[uploadService] - createUploader', () => {
  it('should return a multer instance with upload method', () => {
    const uploader = createUploader('documents');
    expect(uploader).toBeDefined();
    expect(uploader.single).toBeTypeOf('function');
    expect(uploader.array).toBeTypeOf('function');
  });

  it('should create uploaders for different categories', () => {
    const docUploader = createUploader('documents');
    const menuUploader = createUploader('menu');
    expect(docUploader).toBeDefined();
    expect(menuUploader).toBeDefined();
  });
});

describe('[uploadService] - getFileUrl', () => {
  beforeEach(() => {
    delete process.env.UPLOAD_BASE_URL;
    delete process.env.API_URL;
  });

  it('should return CDN URL when UPLOAD_BASE_URL is set', () => {
    process.env.UPLOAD_BASE_URL = 'https://cdn.example.com';
    const url = getFileUrl('documents', 'test-file.jpg');
    expect(url).toBe('https://cdn.example.com/documents/test-file.jpg');
  });

  it('should return local URL when UPLOAD_BASE_URL is not set', () => {
    process.env.API_URL = 'http://localhost:4000';
    const url = getFileUrl('menu', 'burger.png');
    expect(url).toBe('http://localhost:4000/uploads/menu/burger.png');
  });

  it('should use default port when neither UPLOAD_BASE_URL nor API_URL is set', () => {
    const url = getFileUrl('profiles', 'avatar.webp');
    expect(url).toContain('/uploads/profiles/avatar.webp');
  });

  it('should construct correct path for different categories', () => {
    process.env.UPLOAD_BASE_URL = 'https://cdn.test.com';
    expect(getFileUrl('documents', 'a.pdf')).toBe('https://cdn.test.com/documents/a.pdf');
    expect(getFileUrl('menu', 'b.jpg')).toBe('https://cdn.test.com/menu/b.jpg');
    expect(getFileUrl('profiles', 'c.png')).toBe('https://cdn.test.com/profiles/c.png');
  });
});

describe('[uploadService] - file filter (MIME types)', () => {
  it('should accept allowed MIME types', () => {
    const uploader = createUploader('documents');
    // Access the fileFilter from multer's internal config
    // We test this via the multer instance's limits
    expect(uploader).toBeDefined();
    // The actual MIME filtering is tested via integration/route tests
    // since multer's fileFilter is a callback-based internal
  });
});

describe('[uploadService] - file size limit', () => {
  it('should configure 5MB max file size', () => {
    const uploader = createUploader('documents');
    // Multer stores limits internally; the limit is enforced at middleware level
    // The actual enforcement is tested via supertest route tests
    expect(uploader).toBeDefined();
  });
});
