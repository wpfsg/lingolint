import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lingolint/core': `${root}packages/core/src/index.ts`,
      '@lingolint/ai': `${root}packages/ai/src/index.ts`,
    },
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/cli/src/bin.ts'],
    },
  },
});
