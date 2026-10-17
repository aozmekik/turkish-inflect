/**
 * The Turkish alphabet as seen by the phonology: vowel classes, voiceless consonants, letter
 * names and the normalisation of written words into a phonological form.
 *
 * @module
 * @internal
 */

import { toLower } from './casing.js';

/** One of the eight Turkish vowels. */
export type Vowel = 'a' | 'e' | 'ı' | 'i' | 'o' | 'ö' | 'u' | 'ü';

const VOWELS: ReadonlySet<string> = new Set(['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü']);
const FRONT: ReadonlySet<string> = new Set(['e', 'i', 'ö', 'ü']);
const ROUNDED: ReadonlySet<string> = new Set(['o', 'ö', 'u', 'ü']);

/**
 * The voiceless consonants, remembered by Turkish schoolchildren as "fıstıkçı şahap".
 * A suffix-initial d (and c) becomes t (and ç) after them (TDK Yazım Kılavuzu, "Ünsüz Uyumu").
 */
const VOICELESS: ReadonlySet<string> = new Set(['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p']);

/** Letters of the Turkish alphabet, lower case. */
const TURKISH_LETTER = /^[a-zçğıöşü]$/u;

/** Returns true when `ch` is one of the eight Turkish vowels (lower case). */
export function isVowel(ch: string): ch is Vowel {
  return VOWELS.has(ch);
}

/** Returns true for the front (palatal) vowels e, i, ö, ü. */
export function isFront(vowel: Vowel): boolean {
  return FRONT.has(vowel);
}

/** Returns true for the rounded vowels o, ö, u, ü. */
export function isRounded(vowel: Vowel): boolean {
  return ROUNDED.has(vowel);
}

/** Returns true for the voiceless consonants f, s, t, k, ç, ş, h, p. */
export function isVoiceless(ch: string): boolean {
  return VOICELESS.has(ch);
}

/**
 * Names of the letters, used to read abbreviations letter by letter. The 29 Turkish letters
 * follow TDK Yazım Kılavuzu ("Ses, Harf ve Alfabe"); q, w and x are not part of the Turkish
 * alphabet and use their conventional Turkish names (kû, çift ve, iks).
 */
export const LETTER_NAMES: Readonly<Record<string, string>> = {
  a: 'a',
  b: 'be',
  c: 'ce',
  ç: 'çe',
  d: 'de',
  e: 'e',
  f: 'fe',
  g: 'ge',
  ğ: 'yumuşak ge',
  h: 'he',
  ı: 'ı',
  i: 'i',
  j: 'je',
  k: 'ke',
  l: 'le',
  m: 'me',
  n: 'ne',
  o: 'o',
  ö: 'ö',
  p: 'pe',
  r: 're',
  s: 'se',
  ş: 'şe',
  t: 'te',
  u: 'u',
  ü: 'ü',
  v: 've',
  y: 'ye',
  z: 'ze',
  q: 'kû',
  w: 'çift ve',
  x: 'iks',
};

/**
 * Approximations for letters that do not exist in Turkish, so that foreign names can be read
 * by Turkish rules. Circumflexed vowels (â, î, û) are Turkish but harmonise like their plain
 * counterparts (dükkân → dükkânı, kâr → kârı).
 */
const FOREIGN_LETTERS: Readonly<Record<string, string>> = {
  â: 'a',
  á: 'a',
  à: 'a',
  ã: 'a',
  å: 'a',
  ā: 'a',
  ă: 'a',
  ą: 'a',
  ä: 'e',
  æ: 'e',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  ē: 'e',
  ę: 'e',
  ě: 'e',
  î: 'i',
  í: 'i',
  ì: 'i',
  ï: 'i',
  ī: 'i',
  ý: 'i',
  ô: 'o',
  ó: 'o',
  ò: 'o',
  õ: 'o',
  ō: 'o',
  ø: 'ö',
  œ: 'ö',
  ő: 'ö',
  û: 'u',
  ú: 'u',
  ù: 'u',
  ū: 'u',
  ů: 'u',
  ű: 'ü',
  ñ: 'n',
  ń: 'n',
  ň: 'n',
  ß: 'ss',
  ś: 's',
  š: 'ş',
  ž: 'j',
  ź: 'z',
  ż: 'z',
  č: 'ç',
  ć: 'ç',
  ł: 'l',
  ř: 'r',
  ť: 't',
  ď: 'd',
  w: 'v',
  q: 'k',
  x: 'ks',
};

const COMBINING_MARK = /\p{M}/gu;

/**
 * Lower-cases a word with Turkish rules and composes it to NFC, keeping circumflexes.
 * This is the form used for exact lexicon lookups ("âdet" and "adet" are different words).
 */
export function lowerWritten(word: string): string {
  return toLower(word.normalize('NFC')).replace(COMBINING_MARK, '');
}

/**
 * Converts a written word into the phonological form the harmony rules operate on: lower
 * case, Turkish letters only, foreign letters approximated.
 *
 * Turkish spelling never puts "y" after a consonant at the end of a word or between two
 * consonants, so such a "y" is read as the vowel "i" (Harry → harri, Lynn → linn).
 */
export function phonological(word: string): string {
  const lowered = lowerWritten(word);
  let mapped = '';
  for (const ch of lowered) {
    const replacement = FOREIGN_LETTERS[ch];
    if (replacement !== undefined) mapped += replacement;
    else if (TURKISH_LETTER.test(ch)) mapped += ch;
  }
  let out = '';
  for (let index = 0; index < mapped.length; index++) {
    const ch = mapped.charAt(index);
    if (ch === 'y' && index > 0 && !isVowel(mapped.charAt(index - 1))) {
      const next = mapped.charAt(index + 1);
      if (next === '' || !isVowel(next)) {
        out += 'i';
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/** Number of vowels (hence syllables) in a phonological word. */
export function syllableCount(phonologicalWord: string): number {
  let count = 0;
  for (const ch of phonologicalWord) if (isVowel(ch)) count++;
  return count;
}

/** The last vowel of a phonological word, if any. */
export function lastVowel(phonologicalWord: string): Vowel | undefined {
  for (let index = phonologicalWord.length - 1; index >= 0; index--) {
    const ch = phonologicalWord.charAt(index);
    if (isVowel(ch)) return ch;
  }
  return undefined;
}
