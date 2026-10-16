import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the bundle works on GitHub Pages (/Dehors-/) and inside Telegram.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
