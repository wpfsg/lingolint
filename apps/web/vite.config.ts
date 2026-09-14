import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The UI compiles the engine from source so `npm run dev` needs no build step
// and always reflects the current rules.
const coreSource = fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lingolint/core': coreSource,
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
