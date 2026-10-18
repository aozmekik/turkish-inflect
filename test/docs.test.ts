/**
 * Keeps the documentation honest: every `expression; // "result"` line in a TypeScript code
 * block of README.md and of the doc comments in src/ is evaluated and compared.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as library from '../src/index.js';

const root = join(import.meta.dirname, '..');

/** TypeScript code blocks of a Markdown file, or of the doc comments of a source file. */
function codeBlocks(file: string): string[] {
  const text = readFileSync(join(root, file), 'utf8');
  const source = file.endsWith('.ts') ? text.replace(/^\s*\* ?/gmu, '') : text;
  return [...source.matchAll(/```ts\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

interface Example {
  readonly file: string;
  readonly expression: string;
  readonly expected: string;
  /** The configuration of a `createInflector` call earlier in the block. */
  readonly config: string | undefined;
  /** String constants declared earlier in the block (`const name = 'Ahmet';`). */
  readonly constants: Readonly<Record<string, string>>;
}

function examples(file: string): Example[] {
  const found: Example[] = [];
  for (const block of codeBlocks(file)) {
    // A block that sets up its own inflector evaluates its examples with that inflector.
    const setup = /createInflector\((\{[\s\S]*?\n\})\);/u.exec(block);
    const constants: Record<string, string> = {};
    for (const line of block.split('\n')) {
      const constant = /^const (\w+) = '([^']*)';/u.exec(line);
      if (constant !== null) constants[constant[1] ?? ''] = constant[2] ?? '';
      const match = /^(.+?);\s*\/\/\s*"(.*?)"/u.exec(line);
      if (match === null || /^(?:import|const|let)\b/u.test(match[1] ?? '')) continue;
      found.push({
        file,
        expression: match[1] ?? '',
        expected: match[2] ?? '',
        config: setup?.[1],
        constants: { ...constants },
      });
    }
  }
  return found;
}

/** Compiles documentation code; `Function` is the point here, the code under test is the docs. */
function compile(parameters: readonly string[], body: string): (...values: unknown[]) => unknown {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return Function(...parameters, body) as (...values: unknown[]) => unknown;
}

/** Evaluates documentation code with the library's exports (and sample values) in scope. */
function evaluate(example: Example): unknown {
  const scope: Record<string, unknown> = {
    ...library,
    name: 'Ayşe',
    user: 'Ayşe',
    city: 'Bolu',
    ...example.constants,
  };
  if (example.config !== undefined) {
    const config = compile([], `return (${example.config});`)() as library.InflectorConfig;
    Object.assign(scope, library.createInflector(config));
  }
  try {
    return compile(Object.keys(scope), `return (${example.expression});`)(...Object.values(scope));
  } catch (error) {
    return error instanceof Error ? `throws ${error.message}` : 'throws';
  }
}

const files = [
  'README.md',
  ...readdirSync(join(root, 'src'))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => `src/${file}`),
];
const all = files.flatMap(examples);

describe('documentation examples', () => {
  it('finds examples to check', () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it.each(all.map((example) => [`${example.file}: ${example.expression}`, example] as const))(
    '%s',
    (_, example) => {
      expect(evaluate(example)).toBe(example.expected);
    },
  );
});
