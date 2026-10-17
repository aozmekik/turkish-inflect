/**
 * Micro-benchmarks of the built package: `npm run build && npm run bench`.
 * Results depend on the machine and on background load; README.md records the figures
 * measured on the reference machine and how.
 */
import { cpus, platform, release } from 'node:os';

import { Bench } from 'tinybench';
import { format, inflect, tr } from 'turkish-inflect';

const bench = new Bench({ time: 1000, warmupTime: 200 });

bench
  .add('inflect: proper noun (Ayşe → Ayşe’ye)', () => inflect('Ayşe', 'dative'))
  .add('inflect: common noun, softening (kitap → kitabı)', () => inflect('kitap', 'accusative'))
  .add('inflect: number (2026 → 2026’da)', () => inflect(2026, 'locative'))
  .add('inflect: abbreviation (TBMM → TBMM’ye)', () => inflect('TBMM', 'dative'))
  .add('inflect: 4-suffix chain (ev → evdekilerden)', () =>
    inflect('ev', ['locative', 'ki', 'plural', 'ablative']),
  )
  .add('format: one placeholder', () => format('{name:dative} bir mesaj gönderildi', { name: 'Ayşe' }))
  .add('tr: one interpolation', () => tr`${'Ayşe'}'e bir mesaj gönderildi`);

await bench.run();

console.log(`Node ${process.version}, ${platform()} ${release()}, ${cpus()[0]?.model ?? 'unknown CPU'}`);
console.log('| Benchmark | Median throughput (ops/s) | Median latency (ns) | Samples |');
console.log('| --- | ---: | ---: | ---: |');
for (const task of bench.tasks) {
  const result = task.result;
  if (result.state !== 'completed') throw new Error(`${task.name}: ${result.state}`);
  const ops = Math.round(result.throughput.p50).toLocaleString('en-US');
  const latency = Math.round(result.latency.p50 * 1e6).toLocaleString('en-US');
  console.log(`| ${task.name} | ${ops} | ${latency} | ${String(result.latency.samplesCount)} |`);
}
