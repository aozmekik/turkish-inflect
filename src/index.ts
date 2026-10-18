/**
 * turkish-inflect: grammatically correct Turkish suffixes for dynamic values in UI strings.
 *
 * ```ts
 * import { inflect, format, tr } from 'turkish-inflect';
 *
 * inflect('Ayşe', 'dative'); // "Ayşe'ye"
 * inflect('kitap', 'accusative'); // "kitabı"
 * inflect(2026, 'locative'); // "2026'da"
 * format('{name:dative} bir mesaj gönderildi', { name: 'TBMM' }); // "TBMM'ye bir mesaj gönderildi"
 * tr`${'İstanbul'}'daki ofis`; // "İstanbul'daki ofis"
 * ```
 *
 * @packageDocumentation
 */

import type {
  AbbreviationMode,
  Analysis,
  InflectOptions,
  InflectValue,
  ValueKind,
  WordKind,
} from './analysis.js';
import { type Inflector, createInflector } from './inflector.js';
import type { SuffixInput } from './suffixes.js';
import type { TemplateValue, TemplateValues } from './template.js';

export { capitalize, toLower, toUpper } from './casing.js';
export { InflectError, type InflectErrorCode } from './errors.js';
export { createInflector, type InflectDefaults, type Inflector, type InflectorConfig } from './inflector.js';
export {
  DEFAULT_LEXICON,
  type DefaultLexicon,
  type Lexicon,
  type LexiconEntry,
  type ReadingEntry,
} from './lexicon.js';
export { numberToWords, ordinal, type NumberToWordsOptions, type NumericInput } from './numbers.js';
export { SUFFIXES, type Suffix, type SuffixInput } from './suffixes.js';
export type { ValueWithOptions, TemplateValue, TemplateValues } from './template.js';
export type { AbbreviationMode, Analysis, InflectOptions, InflectValue, ValueKind, WordKind };

let shared: Inflector | undefined;

/** The inflector behind the top-level functions, created on first use so that importing only
 * `toUpper` or `numberToWords` does not pull the lexicon into a bundle. */
function defaultInflector(): Inflector {
  shared ??= createInflector();
  return shared;
}

/**
 * Adds one suffix, or a chain of suffixes, to a value.
 *
 * The suffix follows the pronunciation of the value's end: vowel harmony, buffer consonants
 * and d/t assimilation are applied, common nouns soften (kitap → kitabı), and proper nouns,
 * numbers and abbreviations take an apostrophe (TDK Yazım Kılavuzu, Kesme İşareti).
 *
 * @param value - A word or phrase, a number, or a numeral in Turkish notation ("1.000.000").
 * @param suffixes - A suffix name, or names in the order they attach, e.g. `['locative', 'ki']`.
 *   With an empty array the value is returned as written (trimmed, NFC) without being read.
 * @param options - How to read the value; see {@link InflectOptions}.
 * @returns The inflected text.
 * @throws {@link InflectError} when the value is empty or unreadable, a suffix is unknown,
 *   the chain is ungrammatical, or an argument has the wrong type (`INVALID_ARGUMENT`).
 *
 * @example
 * ```ts
 * inflect('Ahmet', 'dative'); // "Ahmet'e"
 * inflect('saat', 'accusative'); // "saati"
 * inflect('NATO', 'dative'); // "NATO'ya"
 * inflect('1.000.000', 'dative'); // "1.000.000'a"
 * inflect('ev', ['locative', 'ki']); // "evdeki"
 * inflect('Avrupa Birliği', 'dative', { compound: true }); // "Avrupa Birliği'ne"
 * ```
 */
export function inflect(value: InflectValue, suffixes: SuffixInput, options?: InflectOptions): string {
  return defaultInflector().inflect(value, suffixes, options);
}

/**
 * Explains how a value will be read: its kind, the spoken form of its end and whether
 * suffixes take an apostrophe. Useful for debugging unexpected suffixes.
 *
 * @example
 * ```ts
 * analyze('TBMM');
 * // { text: 'TBMM', kind: 'abbreviation', reading: 'te be me me', apostrophe: true }
 * analyze(2026).reading; // "iki bin yirmi altı"
 * ```
 */
export function analyze(value: InflectValue, options?: InflectOptions): Analysis {
  return defaultInflector().analyze(value, options);
}

/**
 * Fills a template whose placeholders name a value and, optionally, suffixes joined by `+`.
 * Write `{{` and `}}` for literal braces. Names are identifiers in any script, optionally
 * joined by dots (`{şehir}`, `{user.name}`, a single key). A placeholder without suffixes writes
 * its value as it is, so it accepts values that cannot be read aloud ("C++", an emoji).
 *
 * @param template - Text with `{name}` or `{name:suffix}` or `{name:suffix+suffix}` placeholders.
 * @param values - Values by name; give `{ value, ...options }` to set options for one value.
 * @param options - Options applied to every placeholder.
 * @throws {@link InflectError} `TEMPLATE_SYNTAX`, `MISSING_VALUE`, or any error of {@link inflect}.
 *
 * @example
 * ```ts
 * format('{name:dative} bir mesaj gönderildi', { name: 'Ayşe' }); // "Ayşe'ye bir mesaj gönderildi"
 * format('{city:locative+ki} ofis', { city: 'İzmir' }); // "İzmir'deki ofis"
 * format('{category:locative}', { category: { value: 'Elektronik', kind: 'common' } }); // "Elektronikte"
 * format('Dil: {lang}', { lang: 'C++' }); // "Dil: C++"
 * ```
 */
export function format(template: string, values: TemplateValues, options?: InflectOptions): string {
  return defaultInflector().format(template, values, options);
}

/**
 * Tagged template that corrects the suffix written right after each interpolation.
 *
 * Write the suffix as it would appear for any sample value, with or without an apostrophe
 * ('e, 'ye, 'a ... all mean the dative); it is re-inflected for the actual value. Recognised:
 * the case suffixes, plural, possessives of every person, ki, ordinal and copula, and their
 * combinations ('daki, 'lerden, ınızdan); a first suffix with the pronominal n ('ndan) marks the
 * value as a compound. A following question particle is adjusted too, with its person and tense
 * endings (" mi", " misin", " miydi"). Ambiguous forms are read as accusative (-ı) and genitive
 * (-ın). Letters with a vowel glued to a value that are not suffixes throw `TEMPLATE_SYNTAX`.
 *
 * @example
 * ```ts
 * const name = 'Ahmet';
 * tr`${name}'e mesaj gönderildi`; // "Ahmet'e mesaj gönderildi"
 * tr`${'Ayşe'}'e mesaj gönderildi`; // "Ayşe'ye mesaj gönderildi"
 * tr`${'kitap'}'ı okudum`; // "kitabı okudum"
 * tr`${2026}'da ${'İzmir'} mı?`; // "2026'da İzmir mi?"
 * tr`${'Kurtuluş Savaşı'}'ndan sonra`; // "Kurtuluş Savaşı'ndan sonra"
 * tr`${'Bolu'} misiniz?`; // "Bolu musunuz?"
 * ```
 */
export function tr(strings: TemplateStringsArray, ...values: readonly TemplateValue[]): string {
  return defaultInflector().tr(strings, ...values);
}
