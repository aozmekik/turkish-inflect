/**
 * Suffix phonology: vowel harmony, buffer consonants, consonant assimilation and the stem
 * changes of common nouns (softening, vowel drop, consonant doubling).
 *
 * Suffixes are written as templates in the archiphoneme notation used by Turkish grammars:
 *
 * | Symbol | Realisation                                                  | Rule                     |
 * | ------ | ------------------------------------------------------------ | ------------------------ |
 * | `A`    | a after a back vowel, e after a front vowel                  | two-way vowel harmony    |
 * | `I`    | ı / i / u / ü by backness and rounding of the last vowel     | four-way vowel harmony   |
 * | `D`    | t after a voiceless consonant (f s t k ç ş h p), d otherwise | consonant assimilation   |
 * | `(y)`  | y only after a vowel (likewise `(n)` and `(s)`)              | buffer consonant         |
 * | `(I)`  | a harmonising vowel only after a consonant                   | linking vowel            |
 *
 * Lower-case letters and spaces are literal.
 *
 * @module
 * @internal
 */

import {
  type Vowel,
  isFront,
  isRounded,
  isVoiceless,
  isVowel,
  lastVowel,
  phonological,
  syllableCount,
} from './alphabet.js';
import { toLower, toUpper } from './casing.js';
import type { LexiconEntry } from './lexicon.js';

/** The phonological state at the end of the word built so far. */
export interface Sound {
  /** The last vowel; harmony is decided by it. */
  readonly lastVowel: Vowel;
  /** Whether the word ends in a vowel (selects buffer consonants and linking vowels). */
  readonly endsInVowel: boolean;
  /** Whether the word ends in a voiceless consonant (selects t over d). */
  readonly voiceless: boolean;
  /** Palatal override: the next harmonising vowel is front (saat → saati). */
  readonly front: boolean;
  /** The next buffer consonant is y whatever the template says (su → suyun). */
  readonly bufferY: boolean;
}

type Segment =
  | { readonly kind: 'buffer'; readonly letter: string }
  | { readonly kind: 'linking' }
  | { readonly kind: 'A' }
  | { readonly kind: 'I' }
  | { readonly kind: 'D' }
  | { readonly kind: 'literal'; readonly text: string };

/** A parsed suffix template. */
export type Template = readonly Segment[];

const TEMPLATE_TOKEN = /\((?<optional>[yns]|I)\)|(?<symbol>[AID])|(?<literal>[a-zçğıöşü ]+)/gy;

/**
 * Parses a template such as `(y)A` or `DAn`.
 *
 * @throws Error when the template is malformed; templates are compile-time constants.
 */
export function template(source: string): Template {
  const segments: Segment[] = [];
  TEMPLATE_TOKEN.lastIndex = 0;
  let consumed = 0;
  for (let match = TEMPLATE_TOKEN.exec(source); match; match = TEMPLATE_TOKEN.exec(source)) {
    const { optional, symbol, literal } = match.groups ?? {};
    if (optional === 'I') segments.push({ kind: 'linking' });
    else if (optional !== undefined) segments.push({ kind: 'buffer', letter: optional });
    else if (symbol === 'A' || symbol === 'I' || symbol === 'D') segments.push({ kind: symbol });
    else if (literal !== undefined) segments.push({ kind: 'literal', text: literal });
    consumed = TEMPLATE_TOKEN.lastIndex;
  }
  if (consumed !== source.length) throw new Error(`Malformed suffix template: ${source}`);
  return segments;
}

/**
 * Describes how a phonological word ends.
 *
 * @param word - A word in phonological form (see `phonological`).
 * @returns `undefined` when the word has no vowel and therefore cannot be harmonised.
 */
export function soundOf(word: string, front = false, bufferY = false): Sound | undefined {
  const vowel = lastVowel(word);
  if (vowel === undefined) return undefined;
  const last = word.charAt(word.length - 1);
  return { lastVowel: vowel, endsInVowel: isVowel(last), voiceless: isVoiceless(last), front, bufferY };
}

function fourWay(vowel: Vowel, front: boolean): Vowel {
  const palatal = front || isFront(vowel);
  if (isRounded(vowel)) return palatal ? 'ü' : 'u';
  return palatal ? 'i' : 'ı';
}

function twoWay(vowel: Vowel, front: boolean): Vowel {
  return front || isFront(vowel) ? 'e' : 'a';
}

/** The surface form of a template and the sound at its end. */
export interface Rendered {
  /** The suffix as written. */
  readonly text: string;
  /** The phonological state after the suffix. */
  readonly sound: Sound;
}

/** Realises a template after a word ending in `start`. */
export function render(segments: Template, start: Sound): Rendered {
  let { lastVowel: vowel, endsInVowel, voiceless, front } = start;
  let text = '';
  const emit = (ch: string): void => {
    text += ch;
    if (isVowel(ch)) {
      vowel = ch;
      endsInVowel = true;
      voiceless = false;
      front = false;
    } else {
      endsInVowel = false;
      voiceless = isVoiceless(ch);
    }
  };
  for (const segment of segments) {
    switch (segment.kind) {
      case 'buffer':
        if (endsInVowel) emit(start.bufferY ? 'y' : segment.letter);
        break;
      case 'linking':
        if (!endsInVowel) emit(fourWay(vowel, front));
        break;
      case 'A':
        emit(twoWay(vowel, front));
        break;
      case 'I':
        emit(fourWay(vowel, front));
        break;
      case 'D':
        emit(voiceless ? 't' : 'd');
        break;
      case 'literal':
        for (const ch of segment.text) emit(ch);
        break;
    }
  }
  return { text, sound: { lastVowel: vowel, endsInVowel, voiceless, front, bufferY: false } };
}

/** Whether a rendered suffix begins with a vowel (and so may change the stem). */
export function startsWithVowel(suffix: string): boolean {
  return isVowel(suffix.charAt(0));
}

const SOFT: Readonly<Record<string, string>> = { p: 'b', ç: 'c', t: 'd', k: 'ğ', g: 'ğ' };

/**
 * Whether the default rules soften the final consonant of a common noun: p, ç, k and g in
 * words of two or more syllables (kitap → kitabı, ağaç → ağacı, çocuk → çocuğu,
 * katalog → kataloğu). One-syllable words (top → topu) and words ending in -t
 * (devlet → devleti, paket → paketi) keep their consonant unless the lexicon says otherwise.
 */
function softensByDefault(finalLetter: string, syllables: number): boolean {
  return syllables >= 2 && 'pçkg'.includes(finalLetter);
}

/** Softens the final consonant of a written word, preserving its case. */
function soften(word: string): string {
  const last = word.slice(-1);
  const lower = toLower(last);
  const previous = phonological(word.slice(-2, -1));
  let soft = SOFT[lower];
  if (soft === undefined) return word;
  if (lower === 'k' && previous === 'n')
    soft = 'g'; // renk → rengi, ahenk → ahengi
  else if ((lower === 'k' || lower === 'g') && !isVowel(previous)) return word; // risk → riski
  return word.slice(0, -1) + (last === lower ? soft : toUpper(soft));
}

/** Removes the vowel of the last syllable of a written word (ağız → ağz). */
function dropLastVowel(word: string): string {
  for (let index = word.length - 1; index >= 0; index--) {
    if (isVowel(phonological(word.charAt(index)))) return word.slice(0, index) + word.slice(index + 1);
  }
  return word;
}

/**
 * The form a common noun takes before a vowel-initial suffix: vowel drop, then softening,
 * then doubling (kayıt → kayd-ı, tıp → tıbb-ı, kitap → kitab-ı).
 *
 * @param word - The final written word, in its original case.
 * @param syllables - Syllable count of the word before any change.
 */
export function vowelStem(word: string, entry: LexiconEntry | undefined, syllables: number): string {
  let stem = entry?.dropVowel === true ? dropLastVowel(word) : word;
  const finalLetter = toLower(stem.slice(-1));
  if (entry?.soften ?? softensByDefault(finalLetter, syllables)) stem = soften(stem);
  if (entry?.doubleConsonant === true) stem += stem.slice(-1);
  return stem;
}

/**
 * Attaches a template to a common Turkish word, applying stem changes. Used for number
 * words (dört → dördüncü) where the written form is the word itself.
 */
export function attachToWord(word: string, segments: Template, entry?: LexiconEntry): string {
  const form = phonological(word);
  const sound = soundOf(form, entry?.front ?? false);
  if (sound === undefined) throw new Error(`Cannot harmonise a word without vowels: ${word}`);
  const { text } = render(segments, sound);
  const stem = startsWithVowel(text) ? vowelStem(word, entry, syllableCount(form)) : word;
  return stem + text;
}
