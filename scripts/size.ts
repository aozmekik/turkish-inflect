/**
 * Reports the size of the published files and of a minified bundle of the ESM entry
 * (`npm run build` first). The minified figure is what an application bundler adds when
 * everything is imported; tree shaking can only make it smaller.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { build } from 'esbuild';

const dist = join(import.meta.dirname, '..', 'dist');

function row(label: string, bytes: Uint8Array): string {
  const kib = (n: number): string => `${(n / 1024).toFixed(2)} KiB`;
  return `| ${label} | ${kib(bytes.length)} | ${kib(gzipSync(bytes, { level: 9 }).length)} | ${kib(brotliCompressSync(bytes).length)} |`;
}

const minified = await build({
  entryPoints: [join(dist, 'index.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const bundle = minified.outputFiles[0]?.contents ?? new Uint8Array();

console.log('| File | Raw | gzip -9 | brotli |');
console.log('| --- | --- | --- | --- |');
console.log(row('dist/index.js (ESM)', readFileSync(join(dist, 'index.js'))));
console.log(row('dist/index.cjs (CJS)', readFileSync(join(dist, 'index.cjs'))));
console.log(row('minified ESM bundle', bundle));
