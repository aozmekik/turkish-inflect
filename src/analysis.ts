/**
 * Classifies a value and works out how its end is pronounced, which is all the suffix rules
 * need: the spoken form of the final word, whether the suffix takes an apostrophe, and for
 * common nouns where the written stem may change.
 *
 * Every scan of the value runs in linear time: the end of the value is found by walking
 * backwards, never with an end-anchored regular expression that could backtrack.
 *
 * @module
 */

import { LETTER_NAMES, lowerWritten, phonological, syllableCount } from './alphabet.js';
import { toLower, toUpper } from './casing.js';
import { InflectError } from './errors.js';
import { type CompiledLexicon, type LexiconEntry, UNIT_AFTER_NUMBER_ONLY } from './lexicon.js';
import { formatNumber, readTrailingNumeral } from './numbers.js';
import { type Sound, soundOf } from './phonology.js';

/** How to treat a value whose kind cannot be told from its shape. */
export type WordKind = 'auto' | 'proper' | 'common';

/** How to read an all-capitals word. */
export type AbbreviationMode = 'auto' | 'letters' | 'word';

/** A value that can be inflected. Numbers are written with a decimal comma. */
export type InflectValue = string | number | bigint;

/** Options accepted by `inflect`, `format`, `tr` and `analyze`. */
export interface InflectOptions {
  /**
   * The kind of word (default `'auto'`).
   * - `'auto'`: a last word with a capital letter is a proper noun (Ayşe'ye), all capitals is
   *   an abbreviation (TBMM'ye), a final digit is a number (2026'ya), otherwise common (kitaba).
   * - `'proper'`: always a proper noun: apostrophe, no softening in writing (Tokat'a).
   * - `'common'`: always a common noun: no apostrophe, stem changes (Kitabı for a label
   *   "Kitap"). Also the right choice for institution names, which TDK writes without an
   *   apostrophe (Türk Dil Kurumundan).
   *
   * Values ending in a digit always take an apostrophe, whatever the kind (TDK: 1985'te).
   */
  readonly kind?: WordKind;
  /**
   * How an all-capitals last word is read (default `'auto'`): known acronyms such as NATO and
   * ASELSAN as words, everything else letter by letter with Turkish letter names
   * (TBMM → te-be-me-me → TBMM'ye). `'letters'` and `'word'` force one reading.
   */
  readonly abbreviation?: AbbreviationMode;
  /**
   * The pronunciation of the value in Turkish spelling, for names whose spelling does not
   * tell (`{ reading: 'şekspir' }` for "Shakespeare", `'si plas plas'` for "C++"). Suffixes
   * then follow the last word of the reading; the written value is never changed.
   */
  readonly reading?: string;
  /**
   * The value already ends in a 3rd-person possessive, as compound names do (Avrupa Birliği,
   * Kurtuluş Savaşı, Türk Dil Kurumu). Case suffixes then take the pronominal n:
   * Avrupa Birliği'ne, Kurtuluş Savaşı'nı, Türk Dil Kurumundan. Default `false`.
   */
  readonly compound?: boolean;
  /** The apostrophe character (default `'`). Use `’` (U+2019) for typeset text. */
  readonly apostrophe?: string;
}

/**
 * How the value's suffix is determined:
 * `'common'` and `'proper'` nouns, `'abbreviation'`s (including symbols such as "kg" and
 * dotted abbreviations such as "Dr."), `'number'`s and single `'letter'`s (a'dan z'ye).
 */
export type ValueKind = 'common' | 'proper' | 'abbreviation' | 'number' | 'letter';

/** The result of {@link analyze}: what the library believes about a value. */
export interface Analysis {
  /**
   * The value as it will be written before any suffix: trimmed and composed to Unicode NFC;
   * numbers formatted with a decimal comma.
   */
  readonly text: string;
  /** How the suffix is determined. */
  readonly kind: ValueKind;
  /** How the end of the value is read aloud, e.g. "te be me me" for TBMM. */
  readonly reading: string;
  /** Whether attached suffixes are separated by an apostrophe. */
  readonly apostrophe: boolean;
}

/** {@link Analysis} plus what the suffix machinery needs. */
export interface InternalAnalysis extends Analysis {
  /** Phonological form of the last spoken word. */
  readonly finalWord: string;
  /** How the last spoken word ends, with the lexicon's palatal override applied. */
  readonly sound: Sound;
  /** Lexicon entry for the last word, if any. */
  readonly entry: LexiconEntry | undefined;
  /** For common nouns: where the final written word starts, and its syllable count. */
  readonly stem: { readonly start: number; readonly syllables: number } | undefined;
  /** Whether the value ends in a plain integer (ordinals are allowed). */
  readonly integer: boolean;
}

const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;
const DIGIT_BEFORE = /\d ?$/u;
const SINGLE_LETTER = /^\p{L}\p{M}*$/u;

function hasUpper(text: string): boolean {
  return toLower(text) !== text;
}

function hasLower(text: string): boolean {
  return toUpper(text) !== text;
}

/** The index of the code point that ends at `index` (one or two UTF-16 code units back). */
function previousIndex(text: string, index: number): number {
  const low = text.charCodeAt(index - 1);
  if (index >= 2 && low >= 0xdc00 && low <= 0xdfff) {
    const high = text.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) return index - 2;
  }
  return index - 1;
}

/**
 * Where the run of letters (each optionally followed by combining marks) that ends at `end`
 * starts; `end` itself when there is none.
 */
function lettersStart(text: string, end: number): number {
  let start = end;
  let index = end;
  while (index > 0) {
    const before = previousIndex(text, index);
    const ch = text.slice(before, index);
    if (!MARK.test(ch)) {
      if (!LETTER.test(ch)) break;
      start = before;
    }
    index = before;
  }
  return start;
}

function finalWordOf(reading: string): string {
  const words = reading.trim().split(/\s+/u);
  return phonological(words.at(-1) ?? '');
}

/** The sound of a final word; throws when it has no vowel to harmonise with. */
function soundFor(finalWord: string, entry: LexiconEntry | undefined, source: string): Sound {
  const sound = soundOf(finalWord, entry?.front === true);
  if (sound === undefined) {
    throw new InflectError(
      'UNREADABLE',
      `The reading "${source}" has no Turkish vowel in its last word; write the pronunciation in Turkish spelling.`,
    );
  }
  return sound;
}

function letterReading(token: string): string {
  const names: string[] = [];
  for (const ch of token) {
    const name = LETTER_NAMES[lowerWritten(ch)] ?? LETTER_NAMES[phonological(ch)];
    if (name === undefined) {
      throw new InflectError(
        'UNREADABLE',
        `Cannot read the letter "${ch}" in "${token}"; pass the pronunciation with the \`reading\` option.`,
      );
    }
    names.push(name);
  }
  return names.join(' ');
}

/**
 * The value as written before any suffix: strings trimmed and composed to NFC (so that stem
 * changes never split a letter from its combining mark), numbers formatted.
 *
 * @throws {@link InflectError} `INVALID_NUMBER` for a non-finite number.
 * @internal
 */
export function textOf(value: InflectValue): string {
  if (typeof value === 'string') return value.trim().normalize('NFC');
  return formatNumber(value);
}

/**
 * The kind implied by a value's shape when its pronunciation is known. `registered` values
 * come from the lexicon, where lower-case keys are symbols (cm'yi) rather than common nouns.
 */
function shapeKind(text: string, kind: WordKind, registered: boolean): ValueKind {
  if (/\d$/u.test(text)) return 'number';
  if (kind === 'proper' || kind === 'common') return kind;
  if (text.endsWith('.')) return 'abbreviation';
  if (hasUpper(text)) return hasLower(text) ? 'proper' : 'abbreviation';
  return registered ? 'abbreviation' : 'common';
}

/** The analysis for a value with a known reading (option, or registered in the lexicon). */
function withReading(
  text: string,
  reading: string,
  kind: ValueKind,
  lexicon: CompiledLexicon,
): InternalAnalysis {
  const finalWord = finalWordOf(reading);
  const entry = lexicon.word(finalWord, finalWord);
  const dotted = text.endsWith('.') && kind === 'abbreviation';
  return {
    text,
    kind,
    reading: reading.trim(),
    apostrophe: kind !== 'common' && !dotted,
    finalWord,
    sound: soundFor(finalWord, entry, reading),
    entry,
    stem: undefined,
    integer: false,
  };
}

/**
 * Works out how a value ends when spoken.
 *
 * @internal
 */
export function analyzeValue(
  value: InflectValue,
  options: InflectOptions,
  lexicon: CompiledLexicon,
): InternalAnalysis {
  const text = textOf(value);
  if (text === '') throw new InflectError('EMPTY_VALUE', 'Cannot inflect an empty value.');
  const kind = options.kind ?? 'auto';
  const abbreviation = options.abbreviation ?? 'auto';

  if (options.reading !== undefined) {
    return withReading(text, options.reading, shapeKind(text, kind, false), lexicon);
  }

  // One-letter unit symbols (m, g) only count after a number, which the token lookup handles.
  const registered = UNIT_AFTER_NUMBER_ONLY.has(text) ? undefined : lexicon.reading(text);
  const allCaps = hasUpper(text) && !hasLower(text);
  if (registered !== undefined && !(allCaps && abbreviation === 'letters')) {
    return withReading(text, registered, shapeKind(text, kind, true), lexicon);
  }

  if (text.endsWith('.')) return analyzeDotted(text, lexicon);

  const numeral = readTrailingNumeral(text);
  if (numeral !== undefined) {
    const reading = numeral.words.join(' ');
    const finalWord = finalWordOf(reading);
    return {
      text,
      kind: 'number',
      reading,
      apostrophe: true,
      finalWord,
      sound: soundFor(finalWord, undefined, reading),
      entry: undefined,
      stem: undefined,
      integer: numeral.integer && numeral.start === 0,
    };
  }

  const tokenStart = lettersStart(text, text.length);
  if (tokenStart === text.length) {
    throw new InflectError(
      'UNREADABLE',
      `Cannot tell how "${text}" ends when read aloud; pass the pronunciation with the \`reading\` option.`,
    );
  }
  return analyzeWord(text, text.slice(tokenStart), tokenStart, options, lexicon);
}

function analyzeDotted(text: string, lexicon: CompiledLexicon): InternalAnalysis {
  if (/\d\.$/u.test(text)) {
    throw new InflectError(
      'UNSUPPORTED',
      `"${text}" is an ordinal written with a period, which takes no suffix (TDK: 8'inci, not 8.'inci). Inflect the number with the "ordinal" suffix instead.`,
    );
  }
  const start = lettersStart(text, text.length - 1);
  const token = start === text.length - 1 ? undefined : text.slice(start);
  const reading = token === undefined ? undefined : lexicon.reading(token);
  if (reading === undefined) {
    throw new InflectError(
      'UNREADABLE',
      `Unknown abbreviation "${token ?? text}": abbreviations ending in a period are read as the full word (TDK: Alm.dan, İng.yi). Pass that word with the \`reading\` option or register it in the lexicon.`,
    );
  }
  return withReading(text, reading, 'abbreviation', lexicon);
}

function analyzeWord(
  text: string,
  token: string,
  tokenStart: number,
  options: InflectOptions,
  lexicon: CompiledLexicon,
): InternalAnalysis {
  const kind = options.kind ?? 'auto';
  const abbreviation = options.abbreviation ?? 'auto';
  const upper = hasUpper(token);
  const lower = hasLower(token);
  const single = SINGLE_LETTER.test(token);

  let registered = lexicon.reading(token);
  if (registered !== undefined && UNIT_AFTER_NUMBER_ONLY.has(token)) {
    if (!DIGIT_BEFORE.test(text.slice(0, tokenStart))) registered = undefined;
  }
  if (registered !== undefined && !(upper && !lower && abbreviation === 'letters')) {
    const registeredKind: ValueKind =
      kind === 'common' ? 'common' : upper && lower ? 'proper' : 'abbreviation';
    return withReading(text, registered, registeredKind, lexicon);
  }

  if (single && kind !== 'common') return letters(text, token, 'letter', lexicon);

  if (upper && !lower && kind !== 'common' && abbreviation !== 'word') {
    return letters(text, token, 'abbreviation', lexicon);
  }

  const finalWord = phonological(token);
  if (syllableCount(finalWord) === 0) return letters(text, token, 'abbreviation', lexicon);

  const valueKind: ValueKind =
    upper && !lower && kind === 'auto'
      ? 'abbreviation'
      : kind === 'proper' || (kind === 'auto' && upper)
        ? 'proper'
        : 'common';
  const common = valueKind === 'common';
  const entry = lexicon.word(token, finalWord);
  return {
    text,
    kind: valueKind,
    reading: finalWord,
    apostrophe: !common,
    finalWord,
    sound: soundFor(finalWord, entry, token),
    entry,
    stem: common ? { start: tokenStart, syllables: syllableCount(finalWord) } : undefined,
    integer: false,
  };
}

function letters(text: string, token: string, kind: ValueKind, lexicon: CompiledLexicon): InternalAnalysis {
  const reading = letterReading(token);
  const finalWord = finalWordOf(reading);
  const entry = lexicon.word(finalWord, finalWord);
  return {
    text,
    kind,
    reading,
    apostrophe: true,
    finalWord,
    sound: soundFor(finalWord, entry, reading),
    entry,
    stem: undefined,
    integer: false,
  };
}
