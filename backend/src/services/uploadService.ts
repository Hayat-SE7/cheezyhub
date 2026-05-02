// ─────────────────────────────────────────────────────
//  UPLOAD SERVICE
//  Handles file uploads for driver documents, menu images, etc.
//
//  Storage: local disk by default (./uploads/),
//  set UPLOAD_BASE_URL to serve from a CDN or S3 bucket.
//
//  Files are stored as: uploads/{category}/{timestamp}-{random}.{ext}
// ─────────────────────────────────────────────────────

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Ensure upload directories exist
const CATEGORIES = ['documents', 'menu', 'profiles'];
for (const cat of CATEGORIES) {
  const dir = path.join(UPLOAD_DIR, cat);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
];

/**
 * Create a multer upload middleware for a specific category.
 */
export function createUploader(category: string) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(UPLOAD_DIR, category);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
      cb(null, name);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`));
      }
    },
  });
}

/**
 * Build the public URL for an uploaded file.
 */
export function getFileUrl(category: string, filename: string): string {
  const baseUrl = process.env.UPLOAD_BASE_URL;
  if (baseUrl) {
    return `${baseUrl}/${category}/${filename}`;
  }
  // Default: serve from the API server's /uploads/ static route
  const apiUrl = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return `${apiUrl}/uploads/${category}/${filename}`;
}
