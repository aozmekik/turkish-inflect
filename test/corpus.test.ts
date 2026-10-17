import { describe, expect, it } from 'vitest';

import { inflect } from '../src/index.js';
import { abbreviations } from './corpus/abbreviations.js';
import { consonants } from './corpus/consonants.js';
import { harmony } from './corpus/harmony.js';
import { lexical } from './corpus/lexical.js';
import { morphology } from './corpus/morphology.js';
import { numbers } from './corpus/numbers.js';
import type { Case, Section } from './corpus/types.js';

const groups: Readonly<Record<string, readonly Section[]>> = {
  harmony,
  consonants,
  lexical,
  numbers,
  abbreviations,
  morphology,
};

function label([input, suffix, , options]: Case): string {
  const chain = typeof suffix === 'string' ? suffix : suffix.join('+');
  return `${typeof input === 'bigint' ? `${input.toString()}n` : JSON.stringify(input)} ${chain}${
    options === undefined ? '' : ` ${JSON.stringify(options)}`
  }`;
}

for (const [group, sections] of Object.entries(groups)) {
  describe(group, () => {
    for (const section of sections) {
      describe(section.rule, () => {
        it.each(section.cases.map((testCase) => [label(testCase), testCase] as const))(
          '%s',
          (_, testCase) => {
            const [input, suffix, expected, options] = testCase;
            expect(inflect(input, suffix, options)).toBe(expected);
          },
        );
      });
    }
  });
}

describe('corpus', () => {
  it('has no duplicate expectations', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const sections of Object.values(groups)) {
      for (const section of sections) {
        for (const testCase of section.cases) {
          const key = label(testCase);
          if (seen.has(key)) duplicates.push(key);
          seen.add(key);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });
});
