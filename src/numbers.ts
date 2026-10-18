/**
 * Turkish numbers in words, ordinals, and the reading of numerals that end a value.
 *
 * Numbers are written as separate words (TDK Yazım Kılavuzu, Sayıların Yazılışı: "iki yüz",
 * "bin iki yüz elli bir"). 100 and 1000 are read without "bir" (yüz, bin) while larger scales
 * keep it (bir milyon). The scale words go up to "kentilyon" (10^18), the largest listed in
 * TDK Güncel Türkçe Sözlük, so integers up to 10^21 − 1 can be read.
 *
 * @module
 */

import { InflectError } from './errors.js';
import { attachToWord, template } from './phonology.js';
import { checkOptions, describe } from './validate.js';

const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'] as const;
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'] as const;
const SCALES = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon', 'kentilyon'] as const;
const MAX_DIGITS = SCALES.length * 3;

const LOCATIVE = template('DA');
const ORDINAL = template('(I)ncI');

/** A number given as a JavaScript number, a bigint, or a string in Turkish notation. */
export type NumericInput = number | bigint | string;

/** Options for {@link numberToWords}. */
export interface NumberToWordsOptions {
  /**
   * How the fractional part is read:
   * - `'virgül'` (default): digits after the comma as a number, "3,25" → "üç virgül yirmi beş";
   * - `'tam'`: as a fraction, "3,25" → "üç tam yüzde yirmi beş" (TDK: "5,26 (5 tam, yüzde 26)").
   */
  readonly decimal?: 'virgül' | 'tam';
}

interface ParsedNumber {
  readonly negative: boolean;
  /** Integer digits without grouping separators. */
  readonly integer: string;
  /** Fraction digits, empty when there is no fractional part. */
  readonly fraction: string;
}

/** Turkish notation: optional sign, "." between groups of three, "," before decimals. */
const TURKISH_NUMBER = /^([+\-−])?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/u;
const EXPONENT = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/u;

/** Writes a finite JavaScript number in plain positional notation, never exponential. */
function plainDecimal(value: number): string {
  if (Number.isInteger(value)) return BigInt(value).toString();
  const text = String(value);
  const match = EXPONENT.exec(text);
  if (match === null) return text;
  const [, sign = '', lead = '', rest = '', exponent = '0'] = match;
  // Only |value| < 1e-6 reaches this branch: larger non-integers never use exponents.
  return `${sign}0.${'0'.repeat(-Number(exponent) - 1)}${lead}${rest}`;
}

/**
 * Formats a JavaScript number the way Turkish writes it: a comma before decimals and no
 * grouping (so years stay "2026"). Use `Intl.NumberFormat('tr-TR')` beforehand if you want
 * grouping; the resulting strings are understood as input too.
 *
 * @internal
 */
export function formatNumber(value: number | bigint): string {
  if (typeof value === 'bigint') return value.toString();
  if (!Number.isFinite(value)) {
    throw new InflectError('INVALID_NUMBER', `Expected a finite number, got ${String(value)}.`);
  }
  return plainDecimal(value).replace('.', ',');
}

function parseNumber(input: NumericInput): ParsedNumber {
  if (typeof input !== 'string' && typeof input !== 'number' && typeof input !== 'bigint') {
    throw new InflectError(
      'INVALID_ARGUMENT',
      `Expected a number, bigint or numeric string, got ${describe(input)}.`,
    );
  }
  if (typeof input === 'bigint') {
    const negative = input < 0n;
    return { negative, integer: (negative ? -input : input).toString(), fraction: '' };
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new InflectError('INVALID_NUMBER', `Expected a finite number, got ${String(input)}.`);
    }
    const text = plainDecimal(input);
    const negative = text.startsWith('-');
    const [integer = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
    return { negative, integer, fraction };
  }
  const match = TURKISH_NUMBER.exec(input.trim());
  if (match === null) {
    throw new InflectError(
      'INVALID_NUMBER',
      `"${input}" is not a number in Turkish notation (use "1.234.567,89": "." between thousands, "," before decimals).`,
    );
  }
  const [, sign, integer = '', fraction = ''] = match;
  return { negative: sign === '-' || sign === '−', integer: integer.replaceAll('.', ''), fraction };
}

function groupWords(group: number, words: string[]): void {
  const hundreds = Math.floor(group / 100);
  const tens = Math.floor(group / 10) % 10;
  const ones = group % 10;
  if (hundreds > 1) words.push(ONES[hundreds] ?? '');
  if (hundreds > 0) words.push('yüz');
  if (tens > 0) words.push(TENS[tens] ?? '');
  if (ones > 0) words.push(ONES[ones] ?? '');
}

/**
 * Reads a non-negative integer given as decimal digits.
 *
 * @internal
 */
export function integerWords(digits: string): string[] {
  const significant = digits.replace(/^0+/u, '');
  if (significant === '') return ['sıfır'];
  if (significant.length > MAX_DIGITS) {
    throw new InflectError(
      'OUT_OF_RANGE',
      `Numbers with more than ${String(MAX_DIGITS)} integer digits cannot be read: the largest Turkish scale word is "kentilyon" (10^18).`,
    );
  }
  const groups: number[] = [];
  for (let end = significant.length; end > 0; end -= 3) {
    groups.push(Number(significant.slice(Math.max(0, end - 3), end)));
  }
  const words: string[] = [];
  for (let scale = groups.length - 1; scale >= 0; scale--) {
    const group = groups[scale] ?? 0;
    if (group === 0) continue;
    if (scale === 1 && group === 1) {
      words.push('bin');
      continue;
    }
    groupWords(group, words);
    if (scale > 0) words.push(SCALES[scale] ?? '');
  }
  return words;
}

/**
 * Reads digits that follow a decimal comma or a dot: each leading zero is "sıfır" and the rest
 * is read as a number ("05" → "sıfır beş", "50" → "elli").
 *
 * @internal
 */
export function digitSequenceWords(digits: string): string[] {
  const zeros = /^0*/u.exec(digits)?.[0].length ?? 0;
  const words: string[] = Array.from({ length: zeros }, () => 'sıfır');
  if (zeros < digits.length) words.push(...integerWords(digits.slice(zeros)));
  return words;
}

/** "onda", "yüzde", "binde", "on binde", "milyonda" ... for a fraction with `places` digits. */
function denominatorWords(places: number): string[] {
  const words = integerWords(`1${'0'.repeat(places)}`);
  if (words[0] === 'bir' && words.length > 1) words.shift();
  const last = words.pop() ?? '';
  words.push(attachToWord(last, LOCATIVE));
  return words;
}

function parsedToWords(parsed: ParsedNumber, decimal: 'virgül' | 'tam'): string[] {
  const words = integerWords(parsed.integer);
  if (parsed.fraction !== '') {
    if (decimal === 'tam') {
      words.push('tam', ...denominatorWords(parsed.fraction.length), ...integerWords(parsed.fraction));
    } else {
      words.push('virgül', ...digitSequenceWords(parsed.fraction));
    }
  }
  const isZero = /^0*$/u.test(parsed.integer) && /^0*$/u.test(parsed.fraction);
  if (parsed.negative && !isZero) words.unshift('eksi');
  return words;
}

/**
 * Spells out a number in Turkish words.
 *
 * Strings must use Turkish notation: "." between groups of three digits and "," before the
 * decimals ("1.234.567,89"). Negative numbers are read with "eksi".
 *
 * @throws {@link InflectError} `INVALID_NUMBER` for non-finite numbers or malformed strings,
 *   `OUT_OF_RANGE` for integers of 10^21 or more.
 *
 * @example
 * ```ts
 * numberToWords(2026); // "iki bin yirmi altı"
 * numberToWords('1.000.000'); // "bir milyon"
 * numberToWords(-3.5); // "eksi üç virgül beş"
 * numberToWords('5,26', { decimal: 'tam' }); // "beş tam yüzde yirmi altı"
 * ```
 */
export function numberToWords(value: NumericInput, options: NumberToWordsOptions = {}): string {
  checkOptions(options);
  return parsedToWords(parseNumber(value), options.decimal ?? 'virgül').join(' ');
}

/**
 * Spells out the ordinal of a non-negative integer: 3 → "üçüncü", 4 → "dördüncü".
 *
 * Accepts the digit form with a trailing period ("3."), which is how Turkish writes
 * ordinals with digits.
 *
 * @throws {@link InflectError} `INVALID_NUMBER` for non-integers and negative numbers,
 *   `OUT_OF_RANGE` for integers of 10^21 or more.
 *
 * @example
 * ```ts
 * ordinal(1); // "birinci"
 * ordinal('40.'); // "kırkıncı"
 * ordinal(1_000_000); // "bir milyonuncu"
 * ```
 */
export function ordinal(value: NumericInput): string {
  const parsed = parseNumber(typeof value === 'string' ? value.trim().replace(/(\d)\.$/u, '$1') : value);
  if (parsed.negative || !/^0*$/u.test(parsed.fraction)) {
    throw new InflectError(
      'INVALID_NUMBER',
      `Ordinals are defined for non-negative integers, got ${String(value)}.`,
    );
  }
  const words = integerWords(parsed.integer);
  const last = words.pop() ?? '';
  words.push(ordinalWord(last));
  return words.join(' ');
}

/** Adds the ordinal suffix to a single number word (dört → dördüncü). */
function ordinalWord(word: string): string {
  return attachToWord(word, ORDINAL, word === 'dört' ? { soften: true } : undefined);
}

/** How the numeral at the end of a value is read. */
export interface NumeralReading {
  /** Index in the text where the numeral (including any sign and percent sign) starts. */
  readonly start: number;
  /** The words of the reading, e.g. ["iki", "bin", "yirmi", "altı"]. */
  readonly words: readonly string[];
  /** True when the numeral is a plain integer, which can take the ordinal suffix. */
  readonly integer: boolean;
}

const CLOCK_TIME = /^(\d{1,2})[.:](\d{2})$/u;
const SEPARATOR_WORDS: Readonly<Record<string, string>> = { '.': 'nokta', ',': 'virgül', ':': 'iki nokta' };

function readNumeralBody(body: string): { words: string[]; integer: boolean } {
  const fraction = body.split('/');
  if (fraction.length === 2) {
    const [numerator = '', denominator = ''] = fraction;
    if (TURKISH_NUMBER.test(numerator) && TURKISH_NUMBER.test(denominator)) {
      // TDK: 4/8'i (dört bölü sekizi), 1/2'si (bir bölü ikisi).
      return { words: [...numberWords(numerator), 'bölü', ...numberWords(denominator)], integer: false };
    }
  }
  const clock = CLOCK_TIME.exec(body);
  if (clock !== null) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (hours <= 24 && minutes <= 59) {
      // TDK: 17.30'da (on yedi otuzda), 11.00'de (on birde): zero minutes are not read.
      const words = integerWords(String(hours));
      if (minutes > 0) words.push(...integerWords(String(minutes)));
      return { words, integer: false };
    }
  }
  if (TURKISH_NUMBER.test(body)) {
    const parsed = parseNumber(body);
    return { words: parsedToWords(parsed, 'virgül'), integer: parsed.fraction === '' };
  }
  // Anything else (version numbers such as 1.2.3) is read group by group.
  const words: string[] = [];
  for (const part of body.split(/([.,:/])/u)) {
    if (part === '') continue;
    const separator = part === '/' ? 'bölü' : SEPARATOR_WORDS[part];
    if (separator !== undefined) words.push(separator);
    else words.push(...digitSequenceWords(part));
  }
  return { words, integer: false };
}

function numberWords(text: string): string[] {
  return parsedToWords(parseNumber(text), 'virgül');
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Where the numeral that ends `text` starts: digits with ".", ",", ":" or "/" between them,
 * found by a backward scan (linear time, unlike an end-anchored regular expression).
 */
function numeralStart(text: string): number {
  let start = text.length;
  while (start > 0 && (isDigit(text.charAt(start - 1)) || '.,:/'.includes(text.charAt(start - 1)))) start--;
  while (!isDigit(text.charAt(start))) start++;
  return start;
}

/** Whether a minus sign at `index` is a sign rather than a hyphen ("-5", "(-5", "%-5", not "COVID-19"). */
function isSign(text: string, index: number): boolean {
  const ch = text.charAt(index);
  return (ch === '-' || ch === '−') && (index === 0 || /[\s%‰(]/u.test(text.charAt(index - 1)));
}

/**
 * Reads the numeral at the end of a value: "iPhone 15" → on beş, "%50" → yüzde elli,
 * "-%5" → eksi yüzde beş, "17.30" → on yedi otuz, "1/2" → bir bölü iki.
 *
 * @returns `undefined` when the text does not end in a digit.
 * @internal
 */
export function readTrailingNumeral(text: string): NumeralReading | undefined {
  if (!isDigit(text.charAt(text.length - 1))) return undefined;
  let start = numeralStart(text);
  const body = readNumeralBody(text.slice(start));
  const { words } = body;
  let integer = body.integer;
  if (isSign(text, start - 1)) {
    start -= 1;
    words.unshift('eksi');
    integer = false;
  }
  const prefix = text.charAt(start - 1);
  if (prefix === '%' || prefix === '‰') {
    start -= 1;
    words.unshift(prefix === '%' ? 'yüzde' : 'binde');
    integer = false;
    if (isSign(text, start - 1)) {
      start -= 1;
      words.unshift('eksi');
    }
  }
  return { start, words, integer };
}
