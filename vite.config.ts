import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Project site: https://thomtarzan.github.io/bibel-canvas/
export default defineConfig({
  base: '/bibel-canvas/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
