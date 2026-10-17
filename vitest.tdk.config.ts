import { defineConfig } from 'vitest/config';

/** Opt-in check against TDK Güncel Türkçe Sözlük; needs network access. See CONTRIBUTING.md. */
export default defineConfig({
  test: {
    include: ['test/tdk/**/*.check.ts'],
    testTimeout: 30 * 60 * 1000,
  },
});
