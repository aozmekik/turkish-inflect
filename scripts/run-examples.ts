/**
 * Runs every example against the built package (`npm run build` first). Each example asserts
 * its own output, so a non-zero exit code means the documented behaviour changed.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const directory = join(import.meta.dirname, '..', 'examples');
const examples = readdirSync(directory)
  .filter((file) => file.endsWith('.ts'))
  .sort();

let failed = 0;
for (const example of examples) {
  const result = spawnSync(process.execPath, [join(directory, example)], { encoding: 'utf8' });
  const ok = result.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  examples/${example}`);
  if (!ok) console.log(result.stdout + result.stderr);
}
console.log(`${String(examples.length - failed)}/${String(examples.length)} examples passed`);
process.exitCode = failed === 0 ? 0 : 1;
