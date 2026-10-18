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
import {
  type CompiledLexicon,
  type LexiconEntry,
  type ReadingEntry,
  UNIT_AFTER_NUMBER_ONLY,
} from './lexicon.js';
import { formatNumber, integerWords, readTrailingNumeral } from './numbers.js';
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
   * - `'common'`: a common noun: no apostrophe, stem changes (Kitabı for a label "Kitap"). Also
   *   the right choice for institution names, which TDK writes without an apostrophe (Türk Dil
   *   Kurumundan).
   *
   * Values ending in a digit (TDK: 1985'te), with a superscript (m²ye) or in a capital
   * abbreviation without vowels, which can only be read letter by letter (TBMM'ye), are
   * written as those whatever the kind.
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
const WHITESPACE = /\s/u;
const SINGLE_LETTER = /^\p{L}\p{M}*$/u;
const APOSTROPHES: ReadonlySet<string> = /* @__PURE__ */ new Set(["'", '’']);
const SUPERSCRIPT_DIGITS: Readonly<Record<string, string>> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

function hasUpper(text: string): boolean {
  return toLower(text) !== text;
}

function hasLower(text: string): boolean {
  return toUpper(text) !== text;
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
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

function hasVowelSound(written: string): boolean {
  return syllableCount(phonological(written)) > 0;
}

/**
 * Where the last word of a value starts. A vowelless run after an apostrophe belongs to the
 * word before it (McDonald's, Levi's), while a syllable after one is read on its own, as a
 * Turkish suffix would be (Ahmet'in).
 */
function finalTokenStart(text: string): number {
  let start = lettersStart(text, text.length);
  let vowelless = !hasVowelSound(text.slice(start));
  while (vowelless && start < text.length && APOSTROPHES.has(text.charAt(start - 1))) {
    const before = lettersStart(text, start - 1);
    if (before === start - 1) break;
    vowelless = !hasVowelSound(text.slice(before, start - 1));
    start = before;
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

/** The kind implied by a value's shape when its pronunciation is given with `reading`. */
function shapeKind(text: string, kind: WordKind): ValueKind {
  if (isDigit(text.slice(-1))) return 'number';
  if (kind === 'proper' || kind === 'common') return kind;
  if (text.endsWith('.')) return 'abbreviation';
  if (hasUpper(text)) return hasLower(text) ? 'proper' : 'abbreviation';
  return 'common';
}

/**
 * The kind of a value whose end `key` is registered in the lexicon: lower-case keys are
 * symbols (cm'yi), mixed case keys names (iPhone'a), unless the entry or the call says otherwise.
 */
function registeredKind(key: string, entry: ReadingEntry, kind: WordKind): ValueKind {
  if (isDigit(key.slice(-1))) return 'number';
  if (kind === 'proper' || kind === 'common') return kind;
  if (entry.kind !== undefined) return entry.kind;
  if (key.endsWith('.')) return 'abbreviation';
  return hasUpper(key) && hasLower(key) ? 'proper' : 'abbreviation';
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
 * The analysis of a value whose end, `key` from index `start`, has a registered pronunciation;
 * `undefined` when there is none or it does not apply here.
 */
function analyzeRegistered(
  text: string,
  key: string,
  start: number,
  options: InflectOptions,
  lexicon: CompiledLexicon,
): InternalAnalysis | undefined {
  const entry = lexicon.reading(key);
  if (entry === undefined) return undefined;
  if (UNIT_AFTER_NUMBER_ONLY.has(key)) {
    // One-letter unit symbols (m, g) only count right after a number: "5 m", "100g".
    const before = text.charAt(start - 1) === ' ' ? start - 2 : start - 1;
    if (!isDigit(text.charAt(before))) return undefined;
  }
  if (options.abbreviation === 'letters' && hasUpper(key) && !hasLower(key)) return undefined;
  return withReading(text, entry.reading, registeredKind(key, entry, options.kind ?? 'auto'), lexicon);
}

function analyzeKeyAtEnd(
  text: string,
  options: InflectOptions,
  lexicon: CompiledLexicon,
): InternalAnalysis | undefined {
  const key = lexicon.trailingKey(text);
  return key === undefined
    ? undefined
    : analyzeRegistered(text, key, text.length - key.length, options, lexicon);
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
  if (options.reading !== undefined) {
    return withReading(text, options.reading, shapeKind(text, options.kind ?? 'auto'), lexicon);
  }

  // A registered pronunciation of the whole value, or of its end after a space ("Yeni C#").
  const registered =
    analyzeRegistered(text, text, 0, options, lexicon) ?? analyzeKeyAtEnd(text, options, lexicon);
  if (registered !== undefined) return registered;

  let exponentStart = text.length;
  while (exponentStart > 0 && SUPERSCRIPT_DIGITS[text.charAt(exponentStart - 1)] !== undefined)
    exponentStart--;
  if (exponentStart < text.length) return analyzeExponent(text, exponentStart, lexicon);

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

  const tokenStart = finalTokenStart(text);
  if (tokenStart === text.length) {
    throw new InflectError(
      'UNREADABLE',
      `Cannot tell how "${text}" ends when read aloud; pass the pronunciation with the \`reading\` option.`,
    );
  }
  return analyzeWord(text, text.slice(tokenStart), tokenStart, options, lexicon);
}

/**
 * A value ending in a superscript: m² is "metrekare" and cm³ "santimetreküp", 6⁴ is "altı
 * üssü dört". TDK writes the suffix right after the superscript, without an apostrophe:
 * m²ye, cm³e, 6⁴ten (Yazım Kılavuzu, Kısaltmalar).
 */
function analyzeExponent(text: string, start: number, lexicon: CompiledLexicon): InternalAnalysis {
  const exponent = Array.from(text.slice(start), (ch) => SUPERSCRIPT_DIGITS[ch] ?? '').join('');
  const base = text.slice(0, start);
  const power = ['üssü', ...integerWords(exponent)].join(' ');
  const numeral = readTrailingNumeral(base);
  if (numeral !== undefined) {
    return {
      ...withReading(text, `${numeral.words.join(' ')} ${power}`, 'number', lexicon),
      apostrophe: false,
    };
  }
  const tokenStart = lettersStart(base, base.length);
  const token = base.slice(tokenStart);
  if (token === '') {
    throw new InflectError(
      'UNREADABLE',
      `Cannot tell what the superscript in "${text}" belongs to; pass the pronunciation with the \`reading\` option.`,
    );
  }
  const unit = lexicon.reading(token)?.reading;
  const name =
    unit ?? (SINGLE_LETTER.test(token) || !hasVowelSound(token) ? letterReading(token) : phonological(token));
  // Units form one word with kare and küp (metrekare, santimetreküp); anything else is read
  // as "x kare", "a üssü dört".
  const square = exponent === '2' ? 'kare' : exponent === '3' ? 'küp' : undefined;
  const reading =
    square === undefined ? `${name} ${power}` : unit === undefined ? `${name} ${square}` : name + square;
  return { ...withReading(text, reading, 'abbreviation', lexicon), apostrophe: false };
}

function analyzeDotted(text: string, lexicon: CompiledLexicon): InternalAnalysis {
  if (isDigit(text.charAt(text.length - 2))) {
    throw new InflectError(
      'UNSUPPORTED',
      `"${text}" is an ordinal written with a period, which takes no suffix (TDK: 8'inci, not 8.'inci). Inflect the number with the "ordinal" suffix instead.`,
    );
  }
  const start = lettersStart(text, text.length - 1);
  const token = start === text.length - 1 ? undefined : text.slice(start);
  const reading = token === undefined ? undefined : lexicon.reading(token)?.reading;
  if (reading === undefined) {
    throw new InflectError(
      'UNREADABLE',
      `Unknown abbreviation "${token ?? text}": abbreviations ending in a period are read as the full word (TDK: Alm.dan, İng.yi). Pass that word with the \`reading\` option or register it in the lexicon.`,
    );
  }
  return withReading(text, reading, 'abbreviation', lexicon);
}

/**
 * Whether the word before `start` repeats the final word with a case suffix (şehirden şehir,
 * ağız ağız). TDK Yazım Kılavuzu, Ünlü Düşmesi: in such reduplications the vowel of the second
 * word does not drop (şehirden şehire, ağız ağıza).
 */
function isReduplication(text: string, start: number, token: string): boolean {
  let end = start;
  while (end > 0 && WHITESPACE.test(text.charAt(end - 1))) end--;
  if (end === start) return false;
  const previous = text.slice(lettersStart(text, end), end);
  return previous !== '' && lowerWritten(previous).startsWith(lowerWritten(token));
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

  const registered = analyzeRegistered(text, token, tokenStart, options, lexicon);
  if (registered !== undefined) return registered;

  if (SINGLE_LETTER.test(token) && kind !== 'common') return letters(text, token, 'letter', lexicon);

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
  let entry = lexicon.word(token, finalWord);
  if (common && entry?.dropVowel === true && isReduplication(text, tokenStart, token)) {
    entry = { ...entry, dropVowel: false };
  }
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
