import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    environment: 'node',
    include: ['**/*.unit.test.ts', '**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['services/**', 'middleware/**', 'routes/**', 'utils/**'],
      exclude: ['test/**', '**/*.test.ts'],
    },
    // Integration tests run serially to avoid DB conflicts
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
