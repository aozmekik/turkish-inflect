/**
 * Locale-safe Turkish casing.
 *
 * Turkish has two distinct "i" letters: dotted (i / İ) and dotless (ı / I). The Unicode default
 * case mapping used by `String.prototype.toUpperCase` maps "i" to "I", which is wrong for
 * Turkish, while `toLocaleUpperCase('tr-TR')` depends on the ICU data shipped with the runtime.
 * These helpers apply the four Turkish-specific mappings explicitly and delegate every other
 * character to the locale-independent default mapping, so they behave identically on every
 * JavaScript runtime.
 *
 * @module
 */

import { checkString } from './validate.js';

/** "I" followed by U+0307 COMBINING DOT ABOVE is a decomposed capital dotted I. */
const LOWER_SPECIAL = /İ|[Iİ]/gu;

/**
 * Converts text to upper case using Turkish rules: i → İ and ı → I.
 *
 * @example
 * ```ts
 * toUpper('istanbul ılık'); // "İSTANBUL ILIK"
 * ```
 */
export function toUpper(text: string): string {
  checkString(text, 'the text');
  return text.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();
}

/**
 * Converts text to lower case using Turkish rules: İ → i and I → ı.
 *
 * A decomposed "I + U+0307" is treated as "İ" and becomes "i".
 *
 * @example
 * ```ts
 * toLower('IĞDIR İZMİR'); // "ığdır izmir"
 * ```
 */
export function toLower(text: string): string {
  checkString(text, 'the text');
  return text.replace(LOWER_SPECIAL, (match) => (match === 'I' ? 'ı' : 'i')).toLowerCase();
}

/**
 * Upper-cases the first character and lower-cases the rest, using Turkish rules.
 *
 * @example
 * ```ts
 * capitalize('ırmak'); // "Irmak"
 * capitalize('İSTANBUL'); // "İstanbul"
 * ```
 */
export function capitalize(text: string): string {
  checkString(text, 'the text');
  const first = text.codePointAt(0);
  if (first === undefined) return '';
  const head = String.fromCodePoint(first);
  return toUpper(head) + toLower(text.slice(head.length));
}
