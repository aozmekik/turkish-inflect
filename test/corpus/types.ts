import type { InflectOptions, InflectValue, SuffixInput } from '../../src/index.js';

/** One expectation: inflect(input, suffix, options) === expected. */
export type Case = readonly [
  input: InflectValue,
  suffix: SuffixInput,
  expected: string,
  options?: InflectOptions,
];

/** A group of expectations that exercise one rule. */
export interface Section {
  /** The rule being tested. */
  readonly rule: string;
  /** Where the expected forms come from. */
  readonly source: string;
  readonly cases: readonly Case[];
}

/** The ten forms checked for every word in the harmony sections, in this order. */
export const PARADIGM = [
  'accusative',
  'dative',
  'locative',
  'ablative',
  'genitive',
  'instrumental',
  'plural',
  'possessive',
  'copula',
  'question',
] as const;

/** Pairs a word with its hand-written forms for {@link PARADIGM}. */
export function paradigm(input: string, forms: readonly string[], options?: InflectOptions): Case[] {
  if (forms.length !== PARADIGM.length) {
    throw new Error(`paradigm(${input}) needs ${String(PARADIGM.length)} forms, got ${String(forms.length)}`);
  }
  return PARADIGM.map((suffix, index): Case => {
    const expected = forms[index] ?? '';
    return options === undefined ? [input, suffix, expected] : [input, suffix, expected, options];
  });
}
