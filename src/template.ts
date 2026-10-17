/**
 * Template helpers: `format("{name:dative} ...", values)` and the tagged template
 * tr`${name}'e ...`, both built on `inflect`.
 *
 * @module
 */

import type { InflectOptions, InflectValue } from './analysis.js';
import { InflectError } from './errors.js';
import { type Sound, render } from './phonology.js';
import { type CanonicalSuffix, type Suffix, normalizeChain, specOf } from './suffixes.js';

/** A template value with per-value options, e.g. `{ value: 'Kitap', kind: 'common' }`. */
export interface ValueWithOptions extends InflectOptions {
  /** The value to inflect. */
  readonly value: InflectValue;
}

/** A value passed to `format` or `tr`. */
export type TemplateValue = InflectValue | ValueWithOptions;

/** Named values for `format`. */
export type TemplateValues = Readonly<Record<string, TemplateValue>>;

/** The signature of `inflect` that templates delegate to. */
export type InflectFunction = (
  value: InflectValue,
  suffixes: Suffix | readonly Suffix[],
  options?: InflectOptions,
) => string;

function unpack(value: TemplateValue, options: InflectOptions): [InflectValue, InflectOptions] {
  if (typeof value === 'object') {
    const { value: inner, ...own } = value;
    return [inner, { ...options, ...own }];
  }
  return [value, options];
}

const PLACEHOLDER = /^\s*([A-Za-z_$][\w$]*)\s*(?::([^{}]*))?$/u;

/**
 * Creates `format` bound to an `inflect` implementation.
 *
 * @internal
 */
export function createFormat(
  inflect: InflectFunction,
): (template: string, values: TemplateValues, options?: InflectOptions) => string {
  return (template, values, options = {}) => {
    let out = '';
    let index = 0;
    while (index < template.length) {
      const ch = template.charAt(index);
      if (ch === '}') {
        if (template.charAt(index + 1) !== '}') {
          throw new InflectError(
            'TEMPLATE_SYNTAX',
            `Unmatched "}" at index ${String(index)} (write "}}" for a literal brace).`,
          );
        }
        out += '}';
        index += 2;
        continue;
      }
      if (ch !== '{') {
        out += ch;
        index++;
        continue;
      }
      if (template.charAt(index + 1) === '{') {
        out += '{';
        index += 2;
        continue;
      }
      const close = template.indexOf('}', index);
      const inner = close === -1 ? undefined : PLACEHOLDER.exec(template.slice(index + 1, close));
      if (close === -1 || inner === undefined || inner === null) {
        throw new InflectError(
          'TEMPLATE_SYNTAX',
          `Malformed placeholder at index ${String(index)}: expected {name} or {name:suffix+suffix} (write "{{" for a literal brace).`,
        );
      }
      const [, name = '', spec] = inner;
      const raw = Object.hasOwn(values, name) ? values[name] : undefined;
      if (raw === undefined) {
        throw new InflectError('MISSING_VALUE', `No value for placeholder "{${name}}".`);
      }
      const suffixes = spec === undefined ? [] : spec.split('+').map((part) => part.trim());
      if (suffixes.some((part) => part === '')) {
        throw new InflectError(
          'TEMPLATE_SYNTAX',
          `Empty suffix name in placeholder "{${template.slice(index + 1, close)}}".`,
        );
      }
      const [value, merged] = unpack(raw, options);
      out += inflect(value, suffixes as Suffix[], merged);
      index = close + 1;
    }
    return out;
  };
}

/** Suffixes recognised after a value in a tagged template, in order of preference. */
const MARKER_SUFFIXES: readonly CanonicalSuffix[] = [
  'accusative',
  'dative',
  'locative',
  'ablative',
  'genitive',
  'instrumental',
  'possessive3sg',
  'plural',
  'ki',
  'ordinal',
  'copula',
];

const VOWELS = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'] as const;

/** Every written form a suffix can take, longest first. */
function surfaceForms(suffix: CanonicalSuffix): readonly string[] {
  const spec = specOf(suffix);
  const variants = new Set<string>(suffix === 'ki' ? ['kü'] : []);
  for (const segments of [spec.template, spec.pronominal ?? spec.template]) {
    for (const lastVowel of VOWELS) {
      for (const endsInVowel of [true, false]) {
        for (const voiceless of [true, false]) {
          const sound: Sound = { lastVowel, endsInVowel, voiceless, front: false, bufferY: false };
          variants.add(render(segments, sound).text);
        }
      }
    }
  }
  return [...variants].sort((a, b) => b.length - a.length);
}

const SURFACES: readonly (readonly [CanonicalSuffix, readonly string[]])[] = MARKER_SUFFIXES.map(
  (suffix) => [suffix, surfaceForms(suffix)] as const,
);

function isValidChain(chain: readonly CanonicalSuffix[]): boolean {
  try {
    normalizeChain(chain);
    return true;
  } catch {
    return false;
  }
}

/**
 * Splits the letters written after a placeholder into suffixes, e.g. "daki" → locative + ki,
 * "lerden" → plural + ablative. Returns `undefined` when no valid chain spells them.
 *
 * @internal
 */
export function parseSuffixMarker(letters: string): CanonicalSuffix[] | undefined {
  const search = (position: number, chain: CanonicalSuffix[]): CanonicalSuffix[] | undefined => {
    if (position === letters.length) return chain;
    for (const [suffix, forms] of SURFACES) {
      for (const form of forms) {
        if (!letters.startsWith(form, position)) continue;
        const next = [...chain, suffix];
        if (!isValidChain(next)) continue;
        const found = search(position + form.length, next);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return letters === '' ? undefined : search(0, []);
}

const APOSTROPHE_MARKER = /^(['’])([a-zçğıöşü]*)/u;
const BARE_MARKER = /^[a-zçğıöşü]+/u;
const QUESTION_MARKER = /^ (?:mı|mi|mu|mü)(?![\p{L}\p{M}])/u;

/**
 * Creates the `tr` tagged template bound to an `inflect` implementation.
 *
 * @internal
 */
export function createTag(
  inflect: InflectFunction,
  options: InflectOptions = {},
): (strings: TemplateStringsArray, ...values: readonly TemplateValue[]) => string {
  return (strings, ...values) => {
    const literal = (index: number): string => strings[index] ?? strings.raw[index] ?? '';
    let out = literal(0);
    for (const [index, raw] of values.entries()) {
      const [value, own] = unpack(raw, options);
      let rest = literal(index + 1);
      let chain: CanonicalSuffix[] = [];
      let apostrophe: string | undefined;
      const marked = APOSTROPHE_MARKER.exec(rest);
      if (marked !== null && marked[2] !== '') {
        const [whole, mark = "'", letters = ''] = marked;
        const parsed = parseSuffixMarker(letters);
        if (parsed === undefined) {
          throw new InflectError(
            'TEMPLATE_SYNTAX',
            `Cannot read "${whole}" after placeholder #${String(index + 1)} as Turkish suffixes.`,
          );
        }
        chain = parsed;
        apostrophe = mark;
        rest = rest.slice(whole.length);
      } else {
        const bare = BARE_MARKER.exec(rest)?.[0];
        const parsed = bare === undefined ? undefined : parseSuffixMarker(bare);
        if (bare !== undefined && parsed !== undefined) {
          chain = parsed;
          rest = rest.slice(bare.length);
        }
      }
      const question = QUESTION_MARKER.exec(rest);
      if (question !== null) {
        chain.push('question');
        rest = rest.slice(question[0].length);
      }
      const merged = own.apostrophe === undefined && apostrophe !== undefined ? { ...own, apostrophe } : own;
      out += inflect(value, chain, merged) + rest;
    }
    return out;
  };
}
