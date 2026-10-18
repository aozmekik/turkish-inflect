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
import { InflectError } from './errors.js';
import { checkObject, describe } from './validate.js';

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
  /** The word gains a y before a vowel or a buffer, also where n or s is expected: su → suyu, suyun. */
  readonly bufferY?: boolean;
  /**
   * The word takes the adjectival -ki directly, as time words do (akşamki, yarınki, geçen yılki).
   * Other words need a locative or genitive first (evdeki, Ahmet'inki).
   */
  readonly ki?: boolean;
}

/** A pronunciation registered in {@link Lexicon.readings}, with the kind of value it belongs to. */
export interface ReadingEntry {
  /** The pronunciation in Turkish spelling, e.g. "veb" for "web". */
  readonly reading: string;
  /**
   * How the value is treated. By default the written form decides: mixed case is a proper noun
   * (iPhone'a), anything else an abbreviation or symbol (NATO'ya, kg'dan), and both take an
   * apostrophe. `'common'` is for common nouns whose spelling does not tell their pronunciation
   * (web → "veb": webde), which take no apostrophe.
   */
  readonly kind?: 'common' | 'proper' | 'abbreviation';
}

/**
 * A lexicon extends or overrides the built-in exception lists.
 *
 * @example
 * ```ts
 * const lexicon: Lexicon = {
 *   words: { hevenk: { soften: true }, pazartesi: { ki: true } },
 *   readings: { iPhone: 'ayfon', 'C#': 'si şarp', web: { reading: 'veb', kind: 'common' } },
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
   * The value is written in Turkish spelling; give a {@link ReadingEntry} to also set the kind.
   * Keys are matched against the whole value, then against the end of the value after a space
   * (so "C#" also matches "Yeni C#"), then against the trailing run of letters ("iPhone" in
   * "Yeni iPhone").
   */
  readonly readings?: Readonly<Record<string, string | ReadingEntry>>;
}

/** The type of {@link DEFAULT_LEXICON}: a {@link Lexicon} whose two lists are always present. */
export interface DefaultLexicon extends Lexicon {
  /** The built-in word exceptions. */
  readonly words: Readonly<Record<string, LexiconEntry>>;
  /** The built-in pronunciations. */
  readonly readings: Readonly<Record<string, string>>;
}

/** Adds the flags of `entry` to every word of a list. */
function mark(target: Record<string, LexiconEntry>, words: readonly string[], entry: LexiconEntry): void {
  for (const word of words) target[word] = { ...target[word], ...entry };
}

/**
 * Back-vowel loanwords whose final consonant is pronounced palatal, so suffixes are front.
 * TDK Yazım Kılavuzu, Büyük Ünlü Uyumu: alkol, hakikat, helal, idrak, kabul, kontrol,
 * protokol, saat, sadakat, santral, meçhul, mentol, sembol. The rest are confirmed by the
 * inflection hints in TDK Güncel Türkçe Sözlük (iptal, -li; ampul, -lü; şefkat, -ti).
 */
const FRONT_HARMONY = [
  'alkol',
  'ampul',
  'cemaat',
  'cemal',
  'celal',
  'dijital',
  'dikkat',
  'emsal',
  'etanol',
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
  'idol',
  'ihlal',
  'ihmal',
  'ihtilal',
  'ihtimal',
  'ikbal',
  'ikmal',
  'imal',
  'intikal',
  'iptal',
  'istikbal',
  'istiklal',
  'işgal',
  'itaat',
  'kabahat',
  'kabul',
  'kanaat',
  'kemal',
  'kolesterol',
  'kontrol',
  'kristal',
  'liberal',
  'lokal',
  'mahsul',
  'meal',
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
  'spiral',
  'sual',
  'şefkat',
  'terminal',
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
  'klip',
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
  'ecdat',
  'etüt',
  'evlat',
  'geçit',
  'icat',
  'iktisat',
  'imdat',
  'inat',
  'isnat',
  'istimdat',
  'istinat',
  'itikat',
  'itimat',
  'ittihat',
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
  'mürşit',
  'öğüt',
  'periyot',
  'standart',
  'şahit',
  'şerit',
  'taahhüt',
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
 * Words of two or more syllables ending in p, ç or k that do not soften (TDK: ahlak, evrak,
 * hukuk, ittifak; the rest are headwords of TDK Güncel Türkçe Sözlük without a softening hint).
 */
const NON_SOFTENING = [
  'ahlak',
  'arketip',
  'emlak',
  'evrak',
  'hukuk',
  'ilhak',
  'infilak',
  'istihkak',
  'istintak',
  'ittifak',
  'laptop',
  'merak',
  'mutlak',
  'otostop',
  'prototip',
  'sandviç',
  'stereotip',
  'tahakkuk',
  'tahkik',
  'tahrik',
  'tasdik',
  'tatbik',
  'tedarik',
  'tefrik',
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
  'bahis',
  'bağır',
  'beniz',
  'beyin',
  'boyun',
  'böğür',
  'burun',
  'cisim',
  'devir',
  'emir',
  'fasıl',
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
  'izin',
  'kabir',
  'kahır',
  'karın',
  'kasıt',
  'kayıp',
  'keşif',
  'keyif',
  'kısım',
  'küfür',
  'lütuf',
  'metin',
  'nabız',
  'nakil',
  'nakış',
  'nehir',
  'nesil',
  'nesir',
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
  'şükür',
  'ufuk',
  'vahiy',
  'vakıf',
  'vakit',
  'vasıf',
  'zehir',
  'zihin',
  'zikir',
  'zulüm',
] as const;

/**
 * Arabic loans whose final consonant doubles before a vowel-initial suffix.
 * TDK Yazım Kılavuzu, Ünsüz Türemesi: hak, his, ret, şer, tıp, zam, zan (and af); the rest from
 * TDK Güncel Türkçe Sözlük (fen, -nni; zem, -mmi; şık "option", -kkı).
 */
const DOUBLING = [
  'af',
  'fen',
  'hac',
  'hak',
  'hat',
  'his',
  'sır',
  'şer',
  'şık',
  'üs',
  'zam',
  'zan',
  'zem',
] as const;

/**
 * Words that take the adjectival -ki directly: time words (TDK Yazım Kılavuzu, -ki Eki:
 * akşamki, yarınki, bugünkü, dünkü) and the place words karşı, öte, beri, öbür (karşıki,
 * öteki, beriki, öbürkü). "gün" is left out: TDK lists only bugünkü, dünkü and öbürkü as
 * harmonising, so it cannot confirm "o günkü" against "o günki".
 */
const TAKES_KI = [
  'akşam',
  'ay',
  'bahar',
  'beri',
  'bugün',
  'demin',
  'dün',
  'evvel',
  'geçen',
  'gece',
  'güz',
  'hafta',
  'ilkbahar',
  'karşı',
  'kış',
  'öbür',
  'öğle',
  'önce',
  'öte',
  'sabah',
  'sene',
  'sonbahar',
  'sonra',
  'şimdi',
  'yarın',
  'yaz',
  'yıl',
] as const;

/** Builds the built-in word exceptions; combined entries are written out last. */
function defaultWords(): Record<string, LexiconEntry> {
  const words: Record<string, LexiconEntry> = {};
  mark(words, FRONT_HARMONY, { front: true });
  mark(words, SOFTENING, { soften: true });
  mark(words, NON_SOFTENING, { soften: false });
  mark(words, VOWEL_DROP, { dropVowel: true });
  mark(words, DOUBLING, { doubleConsonant: true });
  mark(words, TAKES_KI, { ki: true });
  return {
    ...words,
    // Combinations.
    kalp: { front: true, soften: true },
    idrak: { front: true, soften: false },
    istimlak: { front: true, soften: false },
    iştirak: { front: true, soften: false },
    had: { front: true, doubleConsonant: true },
    mahal: { front: true, doubleConsonant: true },
    vaat: { front: true, soften: true },
    cet: { soften: true, doubleConsonant: true },
    ret: { soften: true, doubleConsonant: true },
    tıp: { soften: true, doubleConsonant: true },
    zıt: { soften: true, doubleConsonant: true },
    ahit: { dropVowel: true, soften: true },
    akit: { dropVowel: true, soften: true },
    kayıt: { dropVowel: true, soften: true },
    nakit: { dropVowel: true, soften: true },
    su: { bufferY: true },
    // Homographs written with a circumflex that differ from their plain twins.
    âdet: {},
    âkit: {},
    emîr: {},
    hâk: { front: true },
    metîn: {},
    nâkil: {},
  };
}

/**
 * Built-in pronunciations. Upper-case abbreviations are read letter by letter unless listed
 * here (TDK Yazım Kılavuzu, Kısaltmalar: ASELSAN'da, BOTAŞ'ın, NATO'dan, UNESCO'ya; AGİK'in,
 * CMUK'un, RTÜK'e, ÇUKOBİRLİK'e, FİSKOBİRLİK'in; İLESAM, TÖMER).
 * Lower-case symbols follow the full word (cm'yi, kg'dan, mm'den), as do abbreviations that
 * end in a period, which take their suffix without an apostrophe (Alm.dan, İng.yi, kr.un).
 * One-letter symbols (m, g) are only recognised right after a number ("5 m", "100g").
 */
const DEFAULT_READINGS: Readonly<Record<string, string>> = {
  // Acronyms read as words.
  AGİK: 'agik',
  ASELSAN: 'aselsan',
  BOTAŞ: 'botaş',
  CMUK: 'cmuk',
  COVID: 'kovid',
  ÇUKOBİRLİK: 'çukobirlik',
  FIFA: 'fifa',
  FİSKOBİRLİK: 'fiskobirlik',
  HAVELSAN: 'havelsan',
  İLESAM: 'ilesam',
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
  TÖMER: 'tömer',
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

function freezeLexicon(): DefaultLexicon {
  const words = defaultWords();
  for (const entry of Object.values(words)) Object.freeze(entry);
  return Object.freeze({ words: Object.freeze(words), readings: Object.freeze({ ...DEFAULT_READINGS }) });
}

/**
 * The built-in lexicon, deeply frozen. Pass additions or overrides to `createInflector`; this
 * export is for inspecting what the defaults cover.
 */
export const DEFAULT_LEXICON: DefaultLexicon = /* @__PURE__ */ freezeLexicon();

/** One-letter symbols that are only read as units right after a number. */
export const UNIT_AFTER_NUMBER_ONLY: ReadonlySet<string> = /* @__PURE__ */ new Set(['g', 'm']);

/**
 * A compiled, immutable lexicon with lookup helpers.
 *
 * @internal
 */
export interface CompiledLexicon {
  /** Finds the entry for a word, trying the exact lower-case spelling first. */
  word(written: string, phonologicalForm: string): LexiconEntry | undefined;
  /** Finds the pronunciation registered for an exact written form. */
  reading(written: string): ReadingEntry | undefined;
  /**
   * The longest registered key that ends `text` right after whitespace ("C#" in "Yeni C#").
   * Only the last characters of `text`, as many as the longest key has, are examined.
   */
  trailingKey(text: string): string | undefined;
}

const KINDS: readonly (string | undefined)[] = [undefined, 'common', 'proper', 'abbreviation'];

/** Validates one user reading and brings it into the {@link ReadingEntry} form. */
function readingEntry(key: string, value: unknown): ReadingEntry {
  if (typeof value === 'string') return { reading: value };
  const { reading, kind } = checkObject(value, `the reading of "${key}"`);
  if (typeof reading !== 'string' || !KINDS.includes(kind as string | undefined)) {
    throw new InflectError(
      'INVALID_ARGUMENT',
      `The reading of "${key}" must be a string or { reading: string, kind?: 'common' | 'proper' | 'abbreviation' }, got reading ${describe(reading)} and kind ${describe(kind)}.`,
    );
  }
  return kind === undefined ? { reading } : { reading, kind: kind as NonNullable<ReadingEntry['kind']> };
}

const WHITESPACE = /\s/u;

/**
 * Merges a user lexicon over the built-in one.
 *
 * @throws {@link InflectError} `INVALID_ARGUMENT` when the lexicon is malformed.
 */
export function compileLexicon(extra: Lexicon = {}): CompiledLexicon {
  checkObject(extra, 'the lexicon');
  const words = new Map<string, LexiconEntry>(Object.entries(DEFAULT_LEXICON.words));
  if (extra.words !== undefined) {
    checkObject(extra.words, 'lexicon.words');
    for (const [key, entry] of Object.entries(extra.words)) {
      checkObject(entry, `the lexicon entry of "${key}"`);
      words.set(lowerWritten(key), entry);
    }
  }

  const readings = new Map<string, ReadingEntry>();
  for (const [key, reading] of Object.entries(DEFAULT_LEXICON.readings)) readings.set(key, { reading });
  if (extra.readings !== undefined) {
    checkObject(extra.readings, 'lexicon.readings');
    for (const [key, value] of Object.entries(extra.readings)) {
      readings.set(key.normalize('NFC'), readingEntry(key, value));
    }
  }
  let longest = 0;
  for (const key of readings.keys()) longest = Math.max(longest, key.length);

  return {
    word(written, phonologicalForm) {
      return words.get(lowerWritten(written)) ?? words.get(phonologicalForm);
    },
    reading(written) {
      return readings.get(written.normalize('NFC'));
    },
    trailingKey(text) {
      for (let start = Math.max(1, text.length - longest); start < text.length; start++) {
        if (!WHITESPACE.test(text.charAt(start - 1))) continue;
        const key = text.slice(start);
        if (readings.has(key.normalize('NFC'))) return key;
      }
      return undefined;
    },
  };
}
