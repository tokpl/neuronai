import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/tests/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'future/**', '**/dist/**'],
    environment: 'node',
    passWithNoTests: false,
  },
});
