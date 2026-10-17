/**
 * The curated lexicon: words whose inflection the regular rules cannot predict from spelling,
 * and pronunciations of abbreviations, symbols and dotted abbreviations.
 *
 * Every word entry below was taken from, or cross-checked against, TDK sources:
 * - TDK Yazım Kılavuzu, "Sesler ve Ses Uyumları" (sections on Büyük Ünlü Uyumu, Ünsüz
 *   Yumuşaması, Ünlü Düşmesi and Ünsüz Türemesi), and
 * - the inflection hint printed next to each headword in TDK Güncel Türkçe Sözlük
 *   (e.g. "kitap, -bı", "saat, -ti", "ağız, -ğzı"). `npm run check:tdk` re-runs that check.
 *
 * @module
 */

import { lowerWritten } from './alphabet.js';

/**
 * Inflection exceptions for a single word. Every flag is optional and an omitted flag falls
 * back to the default rules, so an empty entry marks a word as regular (useful to shadow a
 * built-in entry, e.g. "âdet" is regular while "adet" softens).
 */
export interface LexiconEntry {
  /**
   * Suffixes take front vowels although the last vowel is back, because the final consonant
   * is pronounced palatal: saat → saati, kalp → kalbi, gol → golü, kontrol → kontrolü.
   */
  readonly front?: boolean;
  /**
   * Whether a final p, ç, t, k (or g) softens before a vowel-initial suffix
   * (kitap → kitabı, renk → rengi). Overrides the default heuristic, which softens p, ç, k
   * and g in words of two or more syllables and nothing in one-syllable words or in -t words.
   */
  readonly soften?: boolean;
  /** The vowel of the last syllable drops before a vowel-initial suffix: ağız → ağzı. */
  readonly dropVowel?: boolean;
  /** The final consonant doubles before a vowel-initial suffix: hak → hakkı, tıp → tıbbı. */
  readonly doubleConsonant?: boolean;
  /** The buffer consonant is always y, also where n or s is expected: su → suyu, suyun. */
  readonly bufferY?: boolean;
}

/**
 * A lexicon extends or overrides the built-in exception lists.
 *
 * @example
 * ```ts
 * const lexicon: Lexicon = {
 *   words: { hevenk: { soften: true } },
 *   readings: { iPhone: 'ayfon', 'C#': 'si şarp', BM: 'birleşmiş milletler' },
 * };
 * ```
 */
export interface Lexicon {
  /**
   * Phonological exceptions keyed by the lower-case word (Turkish casing). Entries apply to
   * the last word of a value, for common and proper nouns alike; stem changes (`soften`,
   * `dropVowel`, `doubleConsonant`, `bufferY`) are only ever written for common nouns.
   */
  readonly words?: Readonly<Record<string, LexiconEntry>>;
  /**
   * Pronunciations keyed by the exact written form: acronyms read as words (NATO → "nato"),
   * lower-case symbols (kg → "kilogram"), dotted abbreviations ("Dr." → "doktor"), or any
   * name whose spelling does not reflect its pronunciation (Shakespeare → "şekspir").
   * The value is written in Turkish spelling. Keys are matched against the whole value first
   * and then against its last word.
   */
  readonly readings?: Readonly<Record<string, string>>;
}

/** Builds a map from a list of words that share one entry. */
function group(words: readonly string[], entry: LexiconEntry): Record<string, LexiconEntry> {
  const out: Record<string, LexiconEntry> = {};
  for (const word of words) out[word] = entry;
  return out;
}

/**
 * Back-vowel loanwords whose final consonant is pronounced palatal, so suffixes are front.
 * TDK Yazım Kılavuzu, Büyük Ünlü Uyumu: alkol, hakikat, helal, idrak, kabul, kontrol,
 * protokol, saat, sadakat, santral, meçhul, mentol, sembol. The rest are confirmed by the
 * inflection hints in TDK Güncel Türkçe Sözlük.
 */
const FRONT_HARMONY = [
  'alkol',
  'cemaat',
  'cemal',
  'celal',
  'dikkat',
  'emsal',
  'festival',
  'final',
  'gol',
  'hakikat',
  'hal',
  'harf',
  'hayal',
  'helal',
  'hilal',
  'hol',
  'ideal',
  'ihmal',
  'ihtimal',
  'ikbal',
  'istiklal',
  'itaat',
  'kabahat',
  'kabul',
  'kanaat',
  'kemal',
  'kontrol',
  'liberal',
  'lokal',
  'mahsul',
  'meçhul',
  'menkul',
  'mentol',
  'metal',
  'mineral',
  'misal',
  'moral',
  'normal',
  'nüzul',
  'petrol',
  'portal',
  'protokol',
  'rol',
  'saat',
  'sadakat',
  'santral',
  'sembol',
  'seyahat',
  'sıhhat',
  'sinyal',
  'sual',
  'timsal',
  'usul',
  'visal',
] as const;

/**
 * Words that soften although the default heuristic would not: one-syllable words
 * (TDK: but, dip, gök, kap, kurt, uç, yurt; bant, bent, cilt, renk) and words ending in -t,
 * mostly native words and loans whose source ends in -d (kanat → kanadı, metot → metodu).
 */
const SOFTENING = [
  // one syllable
  'ant',
  'art',
  'bant',
  'bent',
  'borç',
  'but',
  'cep',
  'cilt',
  'denk',
  'dert',
  'dip',
  'dört',
  'fert',
  'genç',
  'gök',
  'grup',
  'güç',
  'kap',
  'kurt',
  'renk',
  'taç',
  'tat',
  'tunç',
  'uç',
  'yurt',
  // more than one syllable, ending in -t
  'adet',
  'ağıt',
  'armut',
  'cihat',
  'çeşit',
  'damat',
  'etüt',
  'evlat',
  'geçit',
  'inat',
  'itikat',
  'kağıt',
  'kanat',
  'kilit',
  'mabet',
  'maksat',
  'mescit',
  'metot',
  'mevcut',
  'murat',
  'mürit',
  'öğüt',
  'standart',
  'şahit',
  'taklit',
  'tehdit',
  'tevhit',
  'teyit',
  'umut',
  'ümit',
  'üstat',
  'vücut',
  'yiğit',
  'yoğurt',
  'zümrüt',
] as const;

/**
 * Words of two or more syllables ending in p, ç or k that do not soften
 * (TDK: ahlak, evrak, hukuk, ittifak; the rest from TDK Güncel Türkçe Sözlük).
 */
const NON_SOFTENING = [
  'ahlak',
  'arketip',
  'emlak',
  'evrak',
  'hukuk',
  'ittifak',
  'prototip',
  'sandviç',
  'stereotip',
  'tahakkuk',
  'tahrik',
  'tasdik',
  'tatbik',
  'tedarik',
  'teşvik',
  'tetkik',
] as const;

/**
 * Words whose last-syllable vowel drops before a vowel-initial suffix. TDK Yazım Kılavuzu,
 * Ünlü Düşmesi: ağız, alın, bağır, beniz, beyin, boyun, böğür, burun, geniz, göğüs, gönül,
 * karın, oğul; the Arabic loans are confirmed by TDK Güncel Türkçe Sözlük (isim, -smi).
 */
const VOWEL_DROP = [
  'ağız',
  'akıl',
  'akis',
  'alın',
  'asıl',
  'bağır',
  'beniz',
  'beyin',
  'boyun',
  'böğür',
  'burun',
  'cisim',
  'devir',
  'emir',
  'fikir',
  'geniz',
  'göğüs',
  'gönül',
  'hacim',
  'hapis',
  'hasım',
  'hazım',
  'hüküm',
  'ilim',
  'isim',
  'kabir',
  'kahır',
  'karın',
  'kasıt',
  'kayıp',
  'keşif',
  'kısım',
  'lütuf',
  'metin',
  'nabız',
  'nakil',
  'nakış',
  'nehir',
  'nesil',
  'nutuk',
  'oğul',
  'omuz',
  'ömür',
  'resim',
  'sabır',
  'seyir',
  'şahıs',
  'şehir',
  'şekil',
  'ufuk',
  'vakit',
  'vasıf',
  'zehir',
  'zihin',
  'zikir',
  'zulüm',
] as const;

/**
 * Arabic loans whose final consonant doubles before a vowel-initial suffix.
 * TDK Yazım Kılavuzu, Ünsüz Türemesi: hak, his, ret, şer, tıp, zam, zan (and af).
 */
const DOUBLING = ['af', 'hac', 'hak', 'hat', 'his', 'sır', 'şer', 'üs', 'zam', 'zan'] as const;

/** The built-in word exceptions. Later spreads win, so combined entries come last. */
const DEFAULT_WORDS: Readonly<Record<string, LexiconEntry>> = {
  ...group(FRONT_HARMONY, { front: true }),
  ...group(SOFTENING, { soften: true }),
  ...group(NON_SOFTENING, { soften: false }),
  ...group(VOWEL_DROP, { dropVowel: true }),
  ...group(DOUBLING, { doubleConsonant: true }),
  // Combinations.
  kalp: { front: true, soften: true },
  idrak: { front: true, soften: false },
  iştirak: { front: true, soften: false },
  had: { front: true, doubleConsonant: true },
  mahal: { front: true, doubleConsonant: true },
  vaat: { front: true, soften: true },
  ret: { soften: true, doubleConsonant: true },
  tıp: { soften: true, doubleConsonant: true },
  zıt: { soften: true, doubleConsonant: true },
  ahit: { dropVowel: true, soften: true },
  akit: { dropVowel: true, soften: true },
  kayıt: { dropVowel: true, soften: true },
  su: { bufferY: true },
  // Homographs written with a circumflex that differ from their plain twins.
  âdet: {},
  âkit: {},
  emîr: {},
  hâk: { front: true },
  metîn: {},
  nâkil: {},
};

/**
 * Built-in pronunciations. Upper-case abbreviations are read letter by letter unless listed
 * here (TDK Yazım Kılavuzu, Kısaltmalar: ASELSAN'da, BOTAŞ'ın, NATO'dan, UNESCO'ya).
 * Lower-case symbols follow the full word (cm'yi, kg'dan, mm'den), as do abbreviations that
 * end in a period, which take their suffix without an apostrophe (Alm.dan, İng.yi, kr.un).
 * One-letter symbols (m, g) are only recognised right after a number ("5 m", "100g").
 */
const DEFAULT_READINGS: Readonly<Record<string, string>> = {
  // Acronyms read as words.
  AGİK: 'agik',
  ASELSAN: 'aselsan',
  BOTAŞ: 'botaş',
  COVID: 'kovid',
  ÇUKOBİRLİK: 'çukobirlik',
  FIFA: 'fifa',
  HAVELSAN: 'havelsan',
  İŞKUR: 'işkur',
  MÜSİAD: 'müsiad',
  NASA: 'nasa',
  NATO: 'nato',
  ODTÜ: 'odtü',
  OPEC: 'opek',
  PETKİM: 'petkim',
  ROKETSAN: 'roketsan',
  RTÜK: 'rtük',
  TEKEL: 'tekel',
  TOKİ: 'toki',
  TUSAŞ: 'tusaş',
  TÜBİTAK: 'tübitak',
  TÜİK: 'tüik',
  TÜPRAŞ: 'tüpraş',
  TÜSİAD: 'tüsiad',
  UEFA: 'uefa',
  UNESCO: 'unesko',
  UNICEF: 'yunisef',
  YÖK: 'yök',
  // Lower-case symbols.
  cm: 'santimetre',
  dk: 'dakika',
  g: 'gram',
  kg: 'kilogram',
  km: 'kilometre',
  m: 'metre',
  mg: 'miligram',
  ml: 'mililitre',
  mm: 'milimetre',
  sn: 'saniye',
  // Abbreviations ending in a period.
  'Alm.': 'almanca',
  'Apt.': 'apartman',
  'Av.': 'avukat',
  'bkz.': 'bakınız',
  'Cad.': 'cadde',
  'Doç.': 'doçent',
  'Dr.': 'doktor',
  'Fr.': 'fransızca',
  'İng.': 'ingilizce',
  'kr.': 'kuruş',
  'Mah.': 'mahalle',
  'No.': 'no',
  'Prof.': 'profesör',
  'Sok.': 'sokak',
  'vb.': 've benzeri',
  'vs.': 'vesaire',
};

function freeze<T extends object>(record: T): Readonly<T> {
  for (const value of Object.values(record)) if (typeof value === 'object') Object.freeze(value);
  return Object.freeze(record);
}

/**
 * The built-in lexicon, read-only. Pass additions or overrides to `createInflector`; this
 * export is for inspecting what the defaults cover.
 */
export const DEFAULT_LEXICON: Lexicon = Object.freeze({
  words: freeze({ ...DEFAULT_WORDS }),
  readings: freeze({ ...DEFAULT_READINGS }),
});

/** One-letter symbols that are only read as units right after a number. */
export const UNIT_AFTER_NUMBER_ONLY: ReadonlySet<string> = new Set(['g', 'm']);

/**
 * A compiled, immutable lexicon with lookup helpers.
 *
 * @internal
 */
export interface CompiledLexicon {
  /** Finds the entry for a word, trying the exact lower-case spelling first. */
  word(written: string, phonologicalForm: string): LexiconEntry | undefined;
  /** Finds the pronunciation registered for an exact written form. */
  reading(written: string): string | undefined;
}

/** Merges a user lexicon over the built-in one. */
export function compileLexicon(extra?: Lexicon): CompiledLexicon {
  const words = new Map<string, LexiconEntry>();
  for (const [key, entry] of Object.entries(DEFAULT_WORDS)) words.set(key, entry);
  for (const [key, entry] of Object.entries(extra?.words ?? {})) words.set(lowerWritten(key), entry);

  const readings = new Map<string, string>();
  for (const [key, value] of Object.entries(DEFAULT_READINGS)) readings.set(key, value);
  for (const [key, value] of Object.entries(extra?.readings ?? {})) {
    readings.set(key.normalize('NFC'), value);
  }

  return {
    word(written, phonologicalForm) {
      return words.get(lowerWritten(written)) ?? words.get(phonologicalForm);
    },
    reading(written) {
      return readings.get(written.normalize('NFC'));
    },
  };
}
