/**
 * Reports the size of the published files and of minified bundles of the ESM entry
 * (`npm run build` first): everything imported, and a few partial imports that show what tree
 * shaking leaves when an application needs only part of the API.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { build } from 'esbuild';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');

function row(label: string, bytes: Uint8Array): string {
  const kib = (n: number): string => `${(n / 1024).toFixed(2)} KiB`;
  return `| ${label} | ${kib(bytes.length)} | ${kib(gzipSync(bytes, { level: 9 }).length)} | ${kib(brotliCompressSync(bytes).length)} |`;
}

/** Bundles and minifies `export { names } from './dist/index.js'` as an application would. */
async function bundle(names: string): Promise<Uint8Array> {
  const result = await build({
    stdin: { contents: `export ${names} from './dist/index.js';`, resolveDir: root, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  return result.outputFiles[0]?.contents ?? new Uint8Array();
}

console.log('| File | Raw | gzip -9 | brotli |');
console.log('| --- | --- | --- | --- |');
console.log(row('dist/index.js (ESM)', readFileSync(join(dist, 'index.js'))));
console.log(row('dist/index.cjs (CJS)', readFileSync(join(dist, 'index.cjs'))));
console.log(row('minified ESM bundle, everything', await bundle('*')));
for (const names of ['{ inflect }', '{ format, tr }', '{ numberToWords, ordinal }', '{ toUpper, toLower }']) {
  console.log(row(`minified, \`import ${names}\``, await bundle(names)));
}
