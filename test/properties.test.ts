/**
 * Property-based tests: invariants that must hold for generated words and numbers.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { phonological } from '../src/alphabet.js';
import {
  InflectError,
  type Suffix,
  capitalize,
  format,
  inflect,
  numberToWords,
  toLower,
  toUpper,
  tr,
} from '../src/index.js';
import { compileLexicon } from '../src/lexicon.js';

const VOWELS = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'] as const;
const CONSONANTS = Array.from('bcçdfgğhjklmnprsştvyz');
const FRONT = new Set(['e', 'i', 'ö', 'ü']);
const ROUNDED = new Set(['o', 'ö', 'u', 'ü']);
const lexicon = compileLexicon();

/** A syllable: optional onset, vowel, optional coda (no ğ at word start). */
const syllable = fc
  .tuple(
    fc.option(fc.constantFrom(...CONSONANTS.filter((c) => c !== 'ğ')), { nil: '' }),
    fc.constantFrom(...VOWELS),
    fc.option(fc.constantFrom(...CONSONANTS.filter((c) => c !== 'ğ' && c !== 'y')), { nil: '' }),
  )
  .map((parts) => parts.join(''));

/**
 * Lower-case pseudo-Turkish words of two or more letters (single letters are read as letter
 * names) that are not in the lexicon, so no lexical exception applies.
 */
const word = fc
  .array(syllable, { minLength: 1, maxLength: 4 })
  .map((syllables) => syllables.join(''))
  .filter((w) => w.length > 1 && lexicon.word(w, phonological(w)) === undefined);

const properName = word.map(capitalize);

const CASE_SUFFIXES = ['accusative', 'dative', 'locative', 'ablative', 'genitive', 'instrumental'] as const;
const ATTACHED = [...CASE_SUFFIXES, 'possessive', 'copula', 'plural'] as const satisfies readonly Suffix[];
const TWO_WAY: ReadonlySet<Suffix> = new Set(['dative', 'locative', 'ablative', 'instrumental', 'plural']);

function lastVowel(text: string): string {
  for (let index = text.length - 1; index >= 0; index--) {
    const ch = text.charAt(index);
    if ((VOWELS as readonly string[]).includes(ch)) return ch;
  }
  throw new Error(`no vowel in ${text}`);
}

/** The vowel every suffix vowel must equal, by the harmony rules alone. */
function expectedVowel(stemVowel: string, twoWay: boolean): string {
  const front = FRONT.has(stemVowel);
  if (twoWay) return front ? 'e' : 'a';
  if (ROUNDED.has(stemVowel)) return front ? 'ü' : 'u';
  return front ? 'i' : 'ı';
}

describe('properties', () => {
  it('a proper noun is written unchanged, then an apostrophe, then a lower-case suffix', () => {
    fc.assert(
      fc.property(properName, fc.constantFrom(...CASE_SUFFIXES, 'possessive', 'copula'), (name, suffix) => {
        const out = inflect(name, suffix);
        expect(out.startsWith(`${name}'`)).toBe(true);
        expect(out.slice(name.length + 1)).toMatch(/^[a-zçğıöşü]+$/u);
      }),
    );
  });

  it('a proper noun takes no apostrophe before the plural', () => {
    fc.assert(
      fc.property(properName, (name) => {
        expect(inflect(name, 'plural')).toMatch(new RegExp(`^${name}l[ae]r$`, 'u'));
      }),
    );
  });

  it('a common noun never gets an apostrophe', () => {
    fc.assert(
      fc.property(word, fc.constantFrom(...ATTACHED), (noun, suffix) => {
        expect(inflect(noun, suffix)).not.toContain("'");
      }),
    );
  });

  it('suffix vowels agree with the last vowel of the stem', () => {
    fc.assert(
      fc.property(word, fc.constantFrom(...ATTACHED), fc.boolean(), (noun, suffix, proper) => {
        const value = proper ? capitalize(noun) : noun;
        const out = inflect(value, suffix);
        const stemVowel = lastVowel(noun);
        // Softening (kitap → kitab-ı) keeps the stem length, so the suffix starts at the same index.
        const suffixPart = out.slice(value.length + (proper && suffix !== 'plural' ? 1 : 0));
        const suffixVowels = Array.from(suffixPart).filter((ch) =>
          (VOWELS as readonly string[]).includes(ch),
        );
        const expected = expectedVowel(stemVowel, TWO_WAY.has(suffix));
        if (suffix === 'plural' || TWO_WAY.has(suffix)) {
          expect(suffixVowels.every((v) => v === expected)).toBe(true);
        } else {
          expect(suffixVowels.length).toBeGreaterThan(0);
          expect(suffixVowels.every((v) => v === expected)).toBe(true);
        }
      }),
    );
  });

  it('numbers take the suffix of their last spoken word', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 21n - 1n }), fc.constantFrom(...ATTACHED), (n, suffix) => {
        const words = numberToWords(n).split(' ');
        const last = capitalize(words.at(-1) ?? '');
        const viaWord = inflect(last, suffix, { kind: 'proper' }).slice(last.length);
        const viaDigits = inflect(n, suffix).slice(n.toString().length);
        expect(viaDigits).toBe(suffix === 'plural' ? `'${viaWord}` : viaWord);
      }),
    );
  });

  it('numberToWords round-trips through a word parser', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 21n) + 1n, max: 10n ** 21n - 1n }), (n) => {
        const words = numberToWords(n);
        expect(parseTurkishNumber(words)).toBe(n);
        // 100 and 1000 are read without "bir": yüz, bin (but "yirmi bir bin" is 21 000).
        expect(words).not.toMatch(/bir yüz/u);
        expect(words).not.toMatch(/(?:^|eksi |milyon |milyar |trilyon |katrilyon |kentilyon )bir bin/u);
      }),
    );
  });

  it('format and tr agree with inflect', () => {
    fc.assert(
      fc.property(properName, fc.constantFrom(...CASE_SUFFIXES), (name, suffix) => {
        const expected = inflect(name, suffix);
        expect(format(`{x:${suffix}}`, { x: name })).toBe(expected);
        const sample = inflect('Ali', suffix).slice('Ali'.length);
        const strings = Object.assign([``, sample], { raw: [``, sample] });
        expect(tr(strings, name)).toBe(expected);
      }),
    );
  });

  it('Turkish casing round-trips over the Turkish alphabet', () => {
    const turkish = fc.string({
      unit: fc.constantFrom(...Array.from('abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ ')),
    });
    fc.assert(
      fc.property(turkish, (text) => {
        expect(toLower(toUpper(text))).toBe(toLower(text));
        expect(toUpper(toLower(text))).toBe(toUpper(text));
        expect(toUpper(text)).toHaveLength(text.length);
        expect(toLower(text)).toHaveLength(text.length);
        expect(toUpper(text)).not.toMatch(/[iı]/u);
      }),
    );
  });

  it('never throws anything but InflectError, whatever the input', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'grapheme', maxLength: 12 }),
        fc.constantFrom(...ATTACHED),
        (text, suffix) => {
          try {
            expect(typeof inflect(text, suffix)).toBe('string');
          } catch (error) {
            expect(error).toBeInstanceOf(InflectError);
          }
        },
      ),
      { numRuns: 2000 },
    );
  });
});

const UNITS: Readonly<Record<string, bigint>> = {
  sıfır: 0n,
  bir: 1n,
  iki: 2n,
  üç: 3n,
  dört: 4n,
  beş: 5n,
  altı: 6n,
  yedi: 7n,
  sekiz: 8n,
  dokuz: 9n,
  on: 10n,
  yirmi: 20n,
  otuz: 30n,
  kırk: 40n,
  elli: 50n,
  altmış: 60n,
  yetmiş: 70n,
  seksen: 80n,
  doksan: 90n,
};
const SCALES: Readonly<Record<string, bigint>> = {
  bin: 10n ** 3n,
  milyon: 10n ** 6n,
  milyar: 10n ** 9n,
  trilyon: 10n ** 12n,
  katrilyon: 10n ** 15n,
  kentilyon: 10n ** 18n,
};

/** An independent test-only reader of Turkish number words. */
function parseTurkishNumber(text: string): bigint {
  const words = text.split(' ');
  const negative = words[0] === 'eksi';
  let total = 0n;
  let group = 0n;
  for (const w of negative ? words.slice(1) : words) {
    const unit = UNITS[w];
    const scale = SCALES[w];
    if (unit !== undefined) group += unit;
    else if (w === 'yüz') group = (group === 0n ? 1n : group) * 100n;
    else if (scale !== undefined) {
      total += (group === 0n ? 1n : group) * scale;
      group = 0n;
    } else throw new Error(`unexpected word ${w}`);
  }
  total += group;
  return negative ? -total : total;
}
