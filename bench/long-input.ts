/**
 * Times `inflect` on long values that do not end in a readable word, the input that made the
 * first implementation quadratic (docs/adr/0005-linear-time-scanning-of-values.md):
 * `npm run build && node bench/long-input.ts`.
 */
import { InflectError, inflect } from 'turkish-inflect';

const inputs: readonly (readonly [string, string])[] = [
  ["'a' × 40,000 + '!'", 'a'.repeat(40_000) + '!'],
  ["'1' × 40,000 + '!'", '1'.repeat(40_000) + '!'],
  ["'1.' × 20,000 + '!'", '1.'.repeat(20_000) + '!'],
];

for (const [label, input] of inputs) {
  const started = performance.now();
  try {
    inflect(input, 'dative');
  } catch (error) {
    if (!(error instanceof InflectError)) throw error;
  }
  console.log(`${label}: ${(performance.now() - started).toFixed(1)} ms`);
}
