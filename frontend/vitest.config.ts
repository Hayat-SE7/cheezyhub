import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.unit.test.{ts,tsx}', 'src/**/*.integration.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/tests/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/store/**', 'src/hooks/**', 'src/components/**', 'src/lib/**'],
      exclude: ['src/test/**', '**/*.test.*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
