import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary', 'html'],
      // The few uncovered branches are `??` fallbacks that `noUncheckedIndexedAccess` requires
      // on array lookups that cannot miss (e.g. ONES[digit]).
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 97 },
    },
  },
});
