/**
 * Template helpers: `format("{name:dative} ...", values)` and the tagged template
 * tr`${name}'e ...`, both built on `inflect`.
 *
 * @module
 */

import { phonological } from './alphabet.js';
import type { InflectOptions, InflectValue } from './analysis.js';
import { InflectError } from './errors.js';
import { type Sound, type Template, render, soundOf, template } from './phonology.js';
import { type CanonicalSuffix, type Suffix, normalizeChain, specOf } from './suffixes.js';
import { checkObject, checkString, describe } from './validate.js';

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

/**
 * Splits a template value into the value and its own options.
 *
 * @param where - How to name the value in error messages.
 * @throws {@link InflectError} `MISSING_VALUE` for `null` or `undefined`, `INVALID_ARGUMENT`
 *   for an object without a `value`.
 */
function unpack(raw: unknown, options: InflectOptions, where: string): [InflectValue, InflectOptions] {
  if (raw === null || raw === undefined) {
    throw new InflectError('MISSING_VALUE', `${where} is ${String(raw)}.`);
  }
  if (typeof raw !== 'object') return [raw as InflectValue, options];
  if (Array.isArray(raw) || !('value' in raw)) {
    throw new InflectError(
      'INVALID_ARGUMENT',
      `${where} must be a string, number, bigint or { value, ...options }, got ${describe(raw)} without a \`value\`.`,
    );
  }
  const { value, ...own } = raw as ValueWithOptions;
  if ((value as unknown) === null || (value as unknown) === undefined) {
    throw new InflectError('MISSING_VALUE', `${where} has a \`value\` of ${String(value)}.`);
  }
  return [value, { ...options, ...own }];
}

/**
 * `{name}` or `{name:suffix+suffix}`. Names are JavaScript-style identifiers in any script
 * ({şehir}), optionally joined by dots ({user.name}); a dotted name is one key of `values`.
 */
const PLACEHOLDER =
  /^\s*([\p{ID_Start}_$][\p{ID_Continue}$]*(?:\.[\p{ID_Start}_$][\p{ID_Continue}$]*)*)\s*(?::([^{}]*))?$/u;

/**
 * Creates `format` bound to an `inflect` implementation.
 *
 * @internal
 */
export function createFormat(
  inflect: InflectFunction,
): (template: string, values: TemplateValues, options?: InflectOptions) => string {
  return (template, values, options = {}) => {
    checkString(template, 'the template');
    checkObject(values, 'the template values');
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
      const [value, merged] = unpack(raw, options, `The value of placeholder "{${name}}"`);
      out += inflect(value, suffixes as Suffix[], merged);
      index = close + 1;
    }
    return out;
  };
}

/**
 * Suffixes recognised after a value in a tagged template, in order of preference: an ambiguous
 * form is read as the earlier suffix (-ı as accusative rather than 3rd-person possessive, -ın as
 * genitive rather than 2nd-person possessive).
 */
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
  'possessive1sg',
  'possessive2sg',
  'possessive1pl',
  'possessive2pl',
  'possessive3pl',
];

const VOWELS = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'] as const;

/** Every written form of a template, after every kind of word. */
function variants(segments: Template): Set<string> {
  const forms = new Set<string>();
  for (const lastVowel of VOWELS) {
    for (const endsInVowel of [true, false]) {
      for (const voiceless of [true, false]) {
        const sound: Sound = { lastVowel, endsInVowel, voiceless, front: false, bufferY: false };
        forms.add(render(segments, sound).text);
      }
    }
  }
  return forms;
}

/** A written form of a suffix; `pronominal` when only the pronominal-n form spells it. */
interface Surface {
  readonly text: string;
  readonly pronominal: boolean;
}

/** Every written form a suffix can take, longest first. */
function surfaceForms(suffix: CanonicalSuffix): readonly Surface[] {
  const spec = specOf(suffix);
  const forms = new Map<string, boolean>();
  for (const text of variants(spec.template)) forms.set(text, false);
  if (suffix === 'ki') forms.set('kü', false);
  if (spec.pronominal !== undefined) {
    for (const text of variants(spec.pronominal)) if (!forms.has(text)) forms.set(text, true);
  }
  return [...forms]
    .map(([text, pronominal]) => ({ text, pronominal }))
    .sort((a, b) => b.text.length - a.text.length);
}

let surfaces: readonly (readonly [CanonicalSuffix, readonly Surface[]])[] | undefined;

/** The written forms of every marker suffix, computed on the first use of `tr`. */
function markerSurfaces(): readonly (readonly [CanonicalSuffix, readonly Surface[]])[] {
  surfaces ??= MARKER_SUFFIXES.map((suffix) => [suffix, surfaceForms(suffix)] as const);
  return surfaces;
}

function isValidChain(chain: readonly CanonicalSuffix[]): boolean {
  try {
    normalizeChain(chain);
    return true;
  } catch {
    return false;
  }
}

/** The result of {@link parseSuffixMarker}. */
export interface SuffixMarker {
  /** The suffixes, in order. */
  readonly chain: CanonicalSuffix[];
  /**
   * The first suffix was written with the pronominal n ('nı, 'na, 'nda, 'ndan), which only
   * follows a 3rd-person possessive: the value is a compound such as "Kurtuluş Savaşı".
   */
  readonly compound: boolean;
}

/**
 * Splits the letters written after a placeholder into suffixes, e.g. "daki" → locative + ki,
 * "lerden" → plural + ablative, "ndan" → ablative after a compound. Returns `undefined` when
 * no valid chain spells them.
 *
 * @internal
 */
export function parseSuffixMarker(letters: string): SuffixMarker | undefined {
  const search = (
    position: number,
    chain: CanonicalSuffix[],
    compound: boolean,
  ): SuffixMarker | undefined => {
    if (position === letters.length) return { chain, compound };
    for (const [suffix, forms] of markerSurfaces()) {
      for (const form of forms) {
        if (!letters.startsWith(form.text, position)) continue;
        const next = [...chain, suffix];
        if (!isValidChain(next)) continue;
        const found = search(
          position + form.text.length,
          next,
          compound || (position === 0 && form.pronominal),
        );
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return letters === '' ? undefined : search(0, [], false);
}

/**
 * Endings the question particle can carry after its vowel, as templates: mıyım, mısın, mıyız,
 * mısınız, mıdır, mıydı, mıydım, mıydın, mıydık, mıydınız, mıymış.
 */
const QUESTION_ENDINGS = [
  'yIm',
  'sIn',
  'yIz',
  'sInIz',
  'dIr',
  'ydI',
  'ydIm',
  'ydIn',
  'ydIk',
  'ydInIz',
  'ymIş',
];

/** Written forms of the particle that are also ordinary words: "Ali müdür" (Ali is the director). */
const NOT_A_QUESTION: ReadonlySet<string> = new Set(['müdür']);

let questionForms: ReadonlyMap<string, Template> | undefined;

/** Every written form of the question particle, mapped to the template of its ending. */
function questionWords(): ReadonlyMap<string, Template> {
  if (questionForms !== undefined) return questionForms;
  const forms = new Map<string, Template>();
  const endings = QUESTION_ENDINGS.map((ending) => template(ending));
  for (const vowel of ['ı', 'i', 'u', 'ü'] as const) {
    const particle = `m${vowel}`;
    const sound: Sound = {
      lastVowel: vowel,
      endsInVowel: true,
      voiceless: false,
      front: false,
      bufferY: false,
    };
    forms.set(particle, []);
    for (const ending of endings) forms.set(particle + render(ending, sound).text, ending);
  }
  for (const word of NOT_A_QUESTION) forms.delete(word);
  questionForms = forms;
  return forms;
}

const APOSTROPHE_MARKER = /^(['’])([a-zçğıöşü]*)/u;
const BARE_MARKER = /^[a-zçğıöşü]+/u;
const QUESTION_MARKER = /^ (m[ıiuü][\p{L}\p{M}]*)/u;
const VOWEL = /[aeıioöuü]/u;

/** The question particle at the start of `rest` (" mi", " misin", " mıydı"), if any. */
function readQuestion(rest: string): { readonly length: number; readonly ending: Template } | undefined {
  const match = QUESTION_MARKER.exec(rest);
  const ending = match === null ? undefined : questionWords().get(match[1] ?? '');
  return match === null || ending === undefined ? undefined : { length: match[0].length, ending };
}

/** Re-harmonises the ending of the question particle with the particle as it was inflected. */
function questionEnding(inflected: string, ending: Template): string {
  const sound = soundOf(phonological(inflected.slice(-2)));
  /* v8 ignore next -- the particle always ends in a vowel */
  return sound === undefined || ending.length === 0 ? '' : render(ending, sound).text;
}

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
      const where = `Placeholder #${String(index + 1)}`;
      const [value, unpacked] = unpack(raw, options, where);
      let own = unpacked;
      let rest = literal(index + 1);
      let marker: SuffixMarker | undefined;
      let written = '';
      let apostrophe: string | undefined;
      const marked = APOSTROPHE_MARKER.exec(rest);
      if (marked !== null && marked[2] !== '') {
        const [whole, mark = "'", letters = ''] = marked;
        marker = parseSuffixMarker(letters);
        if (marker === undefined) {
          throw new InflectError(
            'TEMPLATE_SYNTAX',
            `Cannot read "${whole}" after ${where} as Turkish suffixes.`,
          );
        }
        written = whole;
        apostrophe = mark;
      } else {
        const bare = BARE_MARKER.exec(rest)?.[0];
        // Letters without a vowel are units or symbols (5x, 10px, 100m), not suffixes.
        if (bare !== undefined && VOWEL.test(bare)) {
          marker = parseSuffixMarker(bare);
          if (marker === undefined) {
            throw new InflectError(
              'TEMPLATE_SYNTAX',
              `Cannot read "${bare}" after ${where} as Turkish suffixes. Write a suffix the tag recognises, or put a space or punctuation after the value.`,
            );
          }
          written = bare;
        }
      }
      rest = rest.slice(written.length);
      const chain = marker === undefined ? [] : [...marker.chain];
      const inferred = marker?.compound === true && own.compound === undefined;
      if (inferred) own = { ...own, compound: true };
      if (own.apostrophe === undefined && apostrophe !== undefined) own = { ...own, apostrophe };
      const question = readQuestion(rest);
      if (question !== undefined) {
        chain.push('question');
        rest = rest.slice(question.length);
      }
      let inflected: string;
      try {
        inflected = inflect(value, chain, own);
      } catch (error) {
        if (inferred && error instanceof InflectError && error.code === 'UNSUPPORTED') {
          throw new InflectError(
            'TEMPLATE_SYNTAX',
            `"${written}" after ${where} starts with the pronominal n (Kurtuluş Savaşı'ndan), which needs a value ending in a 3rd-person possessive. ${error.message}`,
          );
        }
        throw error;
      }
      if (question !== undefined) inflected += questionEnding(inflected, question.ending);
      out += inflected + rest;
    }
    return out;
  };
}
