import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LEXICON,
  InflectError,
  type InflectorConfig,
  SUFFIXES,
  type Suffix,
  analyze,
  createInflector,
  inflect,
} from '../src/index.js';

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof InflectError) return error.code;
    throw error;
  }
  return undefined;
}

describe('inflect', () => {
  it('returns the value unchanged for an empty chain', () => {
    expect(inflect('  Ayşe ', [])).toBe('Ayşe');
    expect(inflect(3.5, [])).toBe('3,5');
  });

  it('does not read a value that takes no suffix', () => {
    expect(inflect('', [])).toBe('');
    expect(inflect('   ', [])).toBe('');
    expect(inflect('C++', [])).toBe('C++');
    expect(inflect('Ayşe 😀', [])).toBe('Ayşe 😀');
    expect(inflect('https://example.com/', [])).toBe('https://example.com/');
    expect(inflect(1e21, [])).toBe('1000000000000000000000');
    expect(inflect(10n ** 30n, [])).toBe(`1${'0'.repeat(30)}`);
    expect(codeOf(() => inflect(Number.POSITIVE_INFINITY, []))).toBe('INVALID_NUMBER');
  });

  it('composes decomposed (NFD) input before changing the stem', () => {
    expect(inflect('ağaç'.normalize('NFD'), 'accusative')).toBe('ağacı');
    expect(inflect('ilaç'.normalize('NFD'), 'accusative')).toBe('ilacı');
    expect(inflect('sevinç'.normalize('NFD'), 'accusative')).toBe('sevinci');
    expect(inflect('göğüs'.normalize('NFD'), 'accusative')).toBe('göğsü');
    expect(inflect('gönül'.normalize('NFD'), 'possessive')).toBe('gönlü');
    expect(inflect('İstanbul'.normalize('NFD'), 'dative')).toBe("İstanbul'a");
    expect(inflect('Çağlar'.normalize('NFD'), [])).toBe('Çağlar');
    expect(analyze('Şule'.normalize('NFD')).text).toBe('Şule');
  });

  it('scans long values in linear time', () => {
    // An end-anchored regular expression made these take seconds (quadratic backtracking);
    // a linear scan takes a few milliseconds. The bound leaves a wide margin for slow CI machines.
    const inputs = ['a'.repeat(100_000) + '!', '1'.repeat(100_000) + '!', '1.'.repeat(50_000) + '!'];
    for (const input of inputs) {
      const started = performance.now();
      expect(codeOf(() => inflect(input, 'dative'))).toBe('UNREADABLE');
      expect(performance.now() - started).toBeLessThan(1000);
    }
    const started = performance.now();
    expect(inflect(`${'çok '.repeat(50_000)}uzun kitap`, 'dative')).toMatch(/uzun kitaba$/u);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('trims surrounding whitespace', () => {
    expect(inflect('  Ayşe\n', 'dative')).toBe("Ayşe'ye");
  });

  it('accepts every documented suffix name', () => {
    for (const suffix of SUFFIXES) {
      const value = suffix === 'ordinal' ? 5 : suffix === 'ki' ? 'yarın' : 'Ayşe';
      expect(typeof inflect(value, suffix)).toBe('string');
    }
  });

  it('treats possessive as an alias of possessive3sg', () => {
    expect(inflect('kitap', 'possessive')).toBe(inflect('kitap', 'possessive3sg'));
    expect(inflect('kitap', ['possessive', 'dative'])).toBe('kitabına');
  });

  it('uses the apostrophe option', () => {
    expect(inflect('Ayşe', 'dative', { apostrophe: '’' })).toBe('Ayşe’ye');
    expect(inflect('kitap', 'dative', { apostrophe: '’' })).toBe('kitaba');
  });

  it('lets kind override the capitalisation heuristic', () => {
    expect(inflect('Kitap', 'dative')).toBe("Kitap'a");
    expect(inflect('Kitap', 'dative', { kind: 'common' })).toBe('Kitaba');
    expect(inflect('kitap', 'dative', { kind: 'proper' })).toBe("kitap'a");
    expect(inflect('ABD', 'dative', { kind: 'proper' })).toBe("ABD'ye");
    expect(inflect('OKUL', 'dative', { kind: 'common' })).toBe('OKULa');
  });

  it('always uses an apostrophe after digits, whatever the kind', () => {
    expect(inflect(5, 'dative', { kind: 'common' })).toBe("5'e");
  });

  it('reads a single letter as a word when kind is common', () => {
    expect(inflect('o', 'dative', { kind: 'common' })).toBe('oya');
  });

  it('falls back to letter names for vowelless words', () => {
    expect(inflect('Brr', 'dative')).toBe("Brr'ye");
    expect(inflect('hmm', 'dative')).toBe("hmm'ye");
  });

  it('applies stem changes only to the last word of a phrase', () => {
    expect(inflect('kitap kitap', 'accusative')).toBe('kitap kitabı');
    expect(inflect('büyük ağaç', 'dative')).toBe('büyük ağaca');
  });

  it('does not change the written stem when a reading is given', () => {
    expect(inflect('kitap', 'accusative', { reading: 'kitap', kind: 'common' })).toBe('kitapı');
  });

  it('treats a lexicon reading of a whole value as authoritative', () => {
    const { inflect: custom } = createInflector({
      lexicon: { readings: { 'C#': 'si şarp', '.NET': 'dat net' } },
    });
    expect(custom('C#', 'dative')).toBe("C#'a");
    expect(custom('.NET', 'locative')).toBe(".NET'te");
    expect(custom('C#', 'dative', { kind: 'common' })).toBe('C#a');
  });

  it('matches registered keys at the end of a value after a space', () => {
    const { inflect: custom } = createInflector({
      lexicon: {
        readings: {
          'C#': 'si şarp',
          'Node.js': 'nod cey es',
          'Visual Studio': 'vijual stüdyo',
          'Windows 11': 'vindovs on bir',
        },
      },
    });
    expect(custom('Yeni C#', 'dative')).toBe("Yeni C#'a");
    expect(custom('Yeni Node.js', 'dative')).toBe("Yeni Node.js'e");
    expect(custom('Microsoft Visual Studio', 'locative')).toBe("Microsoft Visual Studio'da");
    expect(custom('Yeni Windows 11', 'dative', { kind: 'common' })).toBe("Yeni Windows 11'e");
    // Only after whitespace: "XC#" is not "C#".
    expect(codeOf(() => custom('XC#', 'dative'))).toBe('UNREADABLE');
  });

  it('lets a registered reading set the kind of the value', () => {
    const custom = createInflector({
      lexicon: {
        readings: { web: { reading: 'veb', kind: 'common' }, mouse: 'maus', NASA: { reading: 'nasa' } },
      },
    });
    expect(custom.inflect('web', 'locative')).toBe('webde');
    expect(custom.inflect('yeni web', 'dative')).toBe('yeni webe');
    expect(custom.inflect('mouse', 'dative')).toBe("mouse'a");
    expect(custom.inflect('NASA', 'genitive')).toBe("NASA'nın");
    expect(custom.inflect('web', 'locative', { kind: 'proper' })).toBe("web'de");
    expect(custom.analyze('web')).toEqual({ text: 'web', kind: 'common', reading: 'veb', apostrophe: false });
  });

  it('reads a vowelless run after an apostrophe as part of the word before it', () => {
    expect(inflect("McDonald's", 'dative')).toBe("McDonald's'a");
    expect(inflect("Domino's", 'locative')).toBe("Domino's'ta");
    expect(inflect("Levi's", 'dative')).toBe("Levi's'e");
    expect(inflect("rock'n'roll", 'locative', { kind: 'proper' })).toBe("rock'n'roll'da");
    // A syllable after the apostrophe is read on its own, as a Turkish suffix would be.
    expect(inflect("Ahmet'in", 'copula')).toBe("Ahmet'indir");
    expect(analyze("McDonald's").reading).toBe('mcdonalds');
    expect(analyze("'n").reading).toBe('ne');
  });

  it('reads superscripts and writes the suffix without an apostrophe', () => {
    expect(inflect('120 m²', 'dative')).toBe('120 m²ye');
    expect(inflect('m²', 'dative')).toBe('m²ye');
    expect(inflect('cm³', 'dative')).toBe('cm³e');
    expect(inflect('6⁴', 'ablative')).toBe('6⁴ten');
    expect(inflect('x²', 'dative')).toBe('x²ye');
    expect(inflect('a⁴', 'locative')).toBe('a⁴te');
    expect(inflect('2¹⁰', 'dative')).toBe('2¹⁰a');
    expect(analyze('120 m²')).toEqual({
      text: '120 m²',
      kind: 'abbreviation',
      reading: 'metrekare',
      apostrophe: false,
    });
    expect(analyze('6⁴')).toEqual({
      text: '6⁴',
      kind: 'number',
      reading: 'altı üssü dört',
      apostrophe: false,
    });
    expect(analyze('x²').reading).toBe('iks kare');
    expect(analyze('bc²').reading).toBe('be ce kare');
    expect(analyze('ab³').reading).toBe('ab küp');
    expect(codeOf(() => inflect('+²', 'dative'))).toBe('UNREADABLE');
  });

  it('keeps the vowel in reduplications (şehirden şehire)', () => {
    expect(inflect('şehirden şehir', 'dative')).toBe('şehirden şehire');
    expect(inflect('ağız ağız', 'dative')).toBe('ağız ağıza');
    expect(inflect('Şehir şehir', 'dative', { kind: 'common' })).toBe('Şehir şehire');
    expect(inflect('büyük şehir', 'dative')).toBe('büyük şehre');
    expect(inflect('şehir', 'dative')).toBe('şehre');
  });

  it('attaches -ki directly only to words marked for it', () => {
    expect(inflect('geçen yıl', 'ki')).toBe('geçen yılki');
    expect(inflect('bu sabah', 'ki')).toBe('bu sabahki');
    expect(codeOf(() => inflect('ev', 'ki'))).toBe('UNSUPPORTED');
    expect(codeOf(() => inflect('kitap', ['ki', 'plural']))).toBe('UNSUPPORTED');
    expect(codeOf(() => inflect('o gün', 'ki'))).toBe('UNSUPPORTED');
    expect(() => inflect('ev', 'ki')).toThrow(/\["locative", "ki"\]/u);
    const custom = createInflector({ lexicon: { words: { pazartesi: { ki: true } } } });
    expect(custom.inflect('pazartesi', 'ki')).toBe('pazartesiki');
  });

  it('writes the copula on the question particle', () => {
    expect(inflect('kitap', ['question', 'copula'])).toBe('kitap mıdır');
    expect(inflect('Ayşe', ['question', 'copula'])).toBe('Ayşe midir');
    expect(inflect('Ayşe', ['ile', 'question', 'copula'])).toBe('Ayşe ile midir');
    expect(() => inflect('kitap', ['copula', 'question'])).toThrow(/\["question", "copula"\]/u);
  });

  describe('errors', () => {
    it.each<[string, () => unknown, string]>([
      ['empty value', () => inflect('', 'dative'), 'EMPTY_VALUE'],
      ['whitespace value', () => inflect('   ', 'dative'), 'EMPTY_VALUE'],
      ['unknown suffix', () => inflect('Ayşe', 'nominative' as Suffix), 'INVALID_SUFFIX'],
      ['value ending in a symbol', () => inflect('C++', 'dative'), 'UNREADABLE'],
      ['trailing percent sign', () => inflect('50%', 'dative'), 'UNREADABLE'],
      ['letter without a name', () => inflect('ΑΒΓ', 'dative'), 'UNREADABLE'],
      ['reading without a vowel', () => inflect('Brr', 'dative', { reading: 'brr' }), 'UNREADABLE'],
      ['unknown dotted abbreviation', () => inflect('Xyz.', 'dative'), 'UNREADABLE'],
      ['lone period', () => inflect('.', 'dative'), 'UNREADABLE'],
      ['ordinal with a period', () => inflect('8.', 'dative'), 'UNSUPPORTED'],
      ['ordinal on a word', () => inflect('Ayşe', 'ordinal'), 'UNSUPPORTED'],
      ['ordinal on a decimal', () => inflect('3,5', 'ordinal'), 'UNSUPPORTED'],
      ['ordinal on a negative number', () => inflect(-3, 'ordinal'), 'UNSUPPORTED'],
      ['ordinal on a code', () => inflect('iPhone 15', 'ordinal'), 'UNSUPPORTED'],
      ['ordinal on a percentage', () => inflect('%5', 'ordinal'), 'UNSUPPORTED'],
      ['ki directly on a proper noun', () => inflect('Ankara', 'ki'), 'UNSUPPORTED'],
      ['ki directly on a number', () => inflect(2026, 'ki'), 'UNSUPPORTED'],
      ['plural with compound', () => inflect('Kız Kulesi', 'plural', { compound: true }), 'UNSUPPORTED'],
      [
        'possessive with compound',
        () => inflect('Kız Kulesi', 'possessive1pl', { compound: true }),
        'UNSUPPORTED',
      ],
      ['compound without a possessive', () => inflect('Galata', 'dative', { compound: true }), 'UNSUPPORTED'],
      ['two cases', () => inflect('ev', ['locative', 'dative']), 'INVALID_SUFFIX_ORDER'],
      ['case before plural', () => inflect('ev', ['dative', 'plural']), 'INVALID_SUFFIX_ORDER'],
      ['ki after accusative', () => inflect('ev', ['accusative', 'ki']), 'INVALID_SUFFIX_ORDER'],
      ['possessive after ki', () => inflect('ev', ['locative', 'ki', 'possessive']), 'INVALID_SUFFIX_ORDER'],
      ['suffix after ile', () => inflect('ev', ['ile', 'copula']), 'INVALID_SUFFIX_ORDER'],
      ['question after copula', () => inflect('ev', ['copula', 'question']), 'INVALID_SUFFIX_ORDER'],
      ['suffix after question', () => inflect('ev', ['question', 'plural']), 'INVALID_SUFFIX_ORDER'],
      ['ordinal after plural', () => inflect(5, ['plural', 'ordinal']), 'INVALID_SUFFIX_ORDER'],
      ['non-finite number', () => inflect(Number.NaN, 'dative'), 'INVALID_NUMBER'],
      ['number too large', () => inflect(10n ** 21n, 'dative'), 'OUT_OF_RANGE'],
    ])('%s', (_, run, code) => {
      expect(codeOf(run)).toBe(code);
    });

    // Calls from JavaScript that the types reject.
    const untyped = inflect as (...args: unknown[]) => string;
    const untypedAnalyze = analyze as (...args: unknown[]) => unknown;
    it.each<[string, () => unknown]>([
      ['undefined value', () => untyped(undefined, 'dative')],
      ['null value', () => untyped(null, 'dative')],
      ['object value', () => untyped({}, 'dative')],
      ['undefined suffixes', () => untyped('Ayşe', undefined)],
      ['numeric suffix', () => untyped('Ayşe', 3)],
      ['non-string suffix in a chain', () => untyped('Ayşe', ['dative', 1])],
      ['unknown kind', () => untyped('Ali', 'dative', { kind: 'foo' })],
      ['unknown abbreviation mode', () => untyped('NATO', 'dative', { abbreviation: 'spell' })],
      ['non-string reading', () => untyped('Ali', 'dative', { reading: 1 })],
      ['non-boolean compound', () => untyped('Ali', 'dative', { compound: 'yes' })],
      ['non-string apostrophe', () => untyped('Ali', 'dative', { apostrophe: 0 })],
      ['options that are not an object', () => untyped('Ali', 'dative', 'proper')],
      ['null options', () => untyped('Ali', 'dative', null)],
      ['analyze without a value', () => untypedAnalyze()],
      ['analyze with bad options', () => untypedAnalyze('Ali', { kind: 'person' })],
    ])('rejects %s with INVALID_ARGUMENT', (_, run) => {
      expect(codeOf(run)).toBe('INVALID_ARGUMENT');
    });

    it('names the problem in INVALID_ARGUMENT messages', () => {
      expect(() => untyped(undefined, 'dative')).toThrow(
        'Expected a string, number or bigint to inflect, got undefined.',
      );
      expect(() => untyped('Ali', 'dative', { kind: 'foo' })).toThrow(
        'Invalid option kind: "foo". Expected one of: auto, proper, common.',
      );
      expect(() => untyped('Ali', 'dative', { kind: 1 })).toThrow('Invalid option kind: a number.');
      expect(() => untyped('Ali', ['dative', 1])).toThrow('an array with non-string items');
      expect(() => untyped('Ali', 'dative', [])).toThrow(
        'Expected the options to be an object, got an array.',
      );
    });

    it('explains the failure in the message', () => {
      expect(() => inflect('ev', ['dative', 'plural'])).toThrow(/cannot follow "dative"/u);
      expect(() => inflect('C++', 'dative')).toThrow(/`reading` option/u);
    });

    it('is an Error subclass with a name and a code', () => {
      const error = new InflectError('UNREADABLE', 'message');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InflectError');
      expect(error.code).toBe('UNREADABLE');
      expect(error.message).toBe('message');
    });
  });
});

describe('analyze', () => {
  it.each([
    ['TBMM', { text: 'TBMM', kind: 'abbreviation', reading: 'te be me me', apostrophe: true }],
    ['NATO', { text: 'NATO', kind: 'abbreviation', reading: 'nato', apostrophe: true }],
    ['kg', { text: 'kg', kind: 'abbreviation', reading: 'kilogram', apostrophe: true }],
    ['Dr.', { text: 'Dr.', kind: 'abbreviation', reading: 'doktor', apostrophe: false }],
    ['Ayşe', { text: 'Ayşe', kind: 'proper', reading: 'ayşe', apostrophe: true }],
    ['kitap', { text: 'kitap', kind: 'common', reading: 'kitap', apostrophe: false }],
    ['z', { text: 'z', kind: 'letter', reading: 'ze', apostrophe: true }],
    ['BMW', { text: 'BMW', kind: 'abbreviation', reading: 'be me çift ve', apostrophe: true }],
    ['%50', { text: '%50', kind: 'number', reading: 'yüzde elli', apostrophe: true }],
    ['-5', { text: '-5', kind: 'number', reading: 'eksi beş', apostrophe: true }],
    ['1/2', { text: '1/2', kind: 'number', reading: 'bir bölü iki', apostrophe: true }],
    ['17.30', { text: '17.30', kind: 'number', reading: 'on yedi otuz', apostrophe: true }],
    ['v1.2.3', { text: 'v1.2.3', kind: 'number', reading: 'bir nokta iki nokta üç', apostrophe: true }],
    ['1,2,3', { text: '1,2,3', kind: 'number', reading: 'bir virgül iki virgül üç', apostrophe: true }],
    [
      '12:30:45',
      {
        text: '12:30:45',
        kind: 'number',
        reading: 'on iki iki nokta otuz iki nokta kırk beş',
        apostrophe: true,
      },
    ],
    ['1/2/3', { text: '1/2/3', kind: 'number', reading: 'bir bölü iki bölü üç', apostrophe: true }],
    [
      '25:00',
      { text: '25:00', kind: 'number', reading: 'yirmi beş iki nokta sıfır sıfır', apostrophe: true },
    ],
    ['‰5', { text: '‰5', kind: 'number', reading: 'binde beş', apostrophe: true }],
    ['-%5', { text: '-%5', kind: 'number', reading: 'eksi yüzde beş', apostrophe: true }],
    ['%-5', { text: '%-5', kind: 'number', reading: 'yüzde eksi beş', apostrophe: true }],
    ['(-%5', { text: '(-%5', kind: 'number', reading: 'eksi yüzde beş', apostrophe: true }],
    ['COVID-19', { text: 'COVID-19', kind: 'number', reading: 'on dokuz', apostrophe: true }],
    ['Bölüm.3', { text: 'Bölüm.3', kind: 'number', reading: 'üç', apostrophe: true }],
    ['(-5', { text: '(-5', kind: 'number', reading: 'eksi beş', apostrophe: true }],
  ] as const)('%s', (value, expected) => {
    expect(analyze(value)).toEqual(expected);
  });

  it('formats numbers', () => {
    expect(analyze(2026)).toEqual({
      text: '2026',
      kind: 'number',
      reading: 'iki bin yirmi altı',
      apostrophe: true,
    });
    expect(analyze(-0.5).text).toBe('-0,5');
    expect(() => analyze(1e21)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
  });

  it('reports explicit readings and kinds', () => {
    expect(analyze('Shakespeare', { reading: ' şekspir ' })).toEqual({
      text: 'Shakespeare',
      kind: 'proper',
      reading: 'şekspir',
      apostrophe: true,
    });
    expect(analyze('C++', { reading: 'si plas plas' }).kind).toBe('abbreviation');
    expect(analyze('Prof.', { reading: 'profesör' })).toMatchObject({
      kind: 'abbreviation',
      apostrophe: false,
    });
    expect(analyze('web', { reading: 'veb' }).kind).toBe('common');
    expect(analyze('5 GB', { reading: 'beş gigabayt' }).kind).toBe('abbreviation');
    expect(analyze('x5', { reading: 'iks beş' }).kind).toBe('number');
    expect(analyze('web', { reading: 'veb', kind: 'proper' }).kind).toBe('proper');
  });

  it('reads all-capitals text letter by letter unless told otherwise', () => {
    expect(analyze('NATO', { abbreviation: 'letters' }).reading).toBe('ne a te o');
    expect(analyze('ANKARA', { abbreviation: 'word' })).toMatchObject({
      kind: 'abbreviation',
      reading: 'ankara',
    });
    expect(analyze('ANKARA', { abbreviation: 'word', kind: 'proper' }).kind).toBe('proper');
    expect(analyze('ANKARA', { kind: 'common' })).toMatchObject({ kind: 'common', apostrophe: false });
  });

  it('only reads one-letter units after a number', () => {
    expect(analyze('5 m').reading).toBe('metre');
    expect(analyze('m').reading).toBe('me');
    expect(analyze('Plan m').reading).toBe('me');
  });

  it('respects the letters mode for registered acronyms used as a token', () => {
    expect(analyze('5 NATO', { abbreviation: 'letters' }).reading).toBe('ne a te o');
    expect(analyze('Yeni NATO', { abbreviation: 'letters' }).reading).toBe('ne a te o');
    expect(analyze('Yeni NATO').reading).toBe('nato');
  });

  it('classifies registered mixed-case names as proper nouns', () => {
    const custom = createInflector({ lexicon: { readings: { iPhone: 'ayfon' } } });
    expect(custom.analyze('Yeni iPhone')).toMatchObject({ kind: 'proper', reading: 'ayfon' });
    expect(custom.analyze('Yeni iPhone', { kind: 'common' })).toMatchObject({
      kind: 'common',
      apostrophe: false,
    });
  });
});

describe('createInflector', () => {
  it('adds words to the lexicon without affecting the default inflector', () => {
    const custom = createInflector({ lexicon: { words: { mesaj: { front: true }, KEK: { soften: true } } } });
    expect(custom.inflect('mesaj', 'accusative')).toBe('mesaji');
    expect(inflect('mesaj', 'accusative')).toBe('mesajı');
    expect(custom.inflect('kek', 'accusative')).toBe('keği');
    expect(inflect('kek', 'accusative')).toBe('keki');
  });

  it('overrides built-in entries', () => {
    const custom = createInflector({ lexicon: { words: { kitap: { soften: false }, saat: {} } } });
    expect(custom.inflect('kitap', 'accusative')).toBe('kitapı');
    expect(custom.inflect('saat', 'accusative')).toBe('saatı');
  });

  it('registers pronunciations', () => {
    const { inflect: custom, format } = createInflector({
      lexicon: { readings: { iPhone: 'ayfon', Shakespeare: 'şekspir', BM: 'birleşmiş milletler' } },
    });
    expect(custom('iPhone', 'dative')).toBe("iPhone'a");
    expect(custom('Yeni iPhone', 'dative')).toBe("Yeni iPhone'a");
    expect(custom('BM', 'locative')).toBe("BM'de");
    expect(custom('BM', 'dative')).toBe("BM'e");
    expect(custom('BM', 'dative', { abbreviation: 'letters' })).toBe("BM'ye");
    expect(format('{author:genitive} oyunları', { author: 'Shakespeare' })).toBe("Shakespeare'in oyunları");
  });

  it('applies defaults, which calls can override', () => {
    const custom = createInflector({ defaults: { apostrophe: '’', kind: 'proper' } });
    expect(custom.inflect('ayşe', 'dative')).toBe('ayşe’ye');
    expect(custom.inflect('Ayşe', 'dative', { apostrophe: "'" })).toBe("Ayşe'ye");
    expect(custom.analyze('kitap').kind).toBe('proper');
    expect(custom.tr`${'Ali'}'ye`).toBe('Ali’ye');
  });

  it('exposes a frozen copy of the built-in lexicon', () => {
    expect(DEFAULT_LEXICON.words['saat']).toEqual({ front: true });
    expect(DEFAULT_LEXICON.words['akşam']).toEqual({ ki: true });
    expect(DEFAULT_LEXICON.readings['NATO']).toBe('nato');
    expect(Object.isFrozen(DEFAULT_LEXICON)).toBe(true);
    expect(Object.isFrozen(DEFAULT_LEXICON.words)).toBe(true);
    expect(Object.isFrozen(DEFAULT_LEXICON.readings)).toBe(true);
    expect(Object.isFrozen(DEFAULT_LEXICON.words['saat'])).toBe(true);
  });

  it('exposes a frozen list of suffix names', () => {
    expect(Object.isFrozen(SUFFIXES)).toBe(true);
    expect(() => (SUFFIXES as unknown as string[]).push('x')).toThrow(TypeError);
  });

  it.each<[string, unknown]>([
    ['a configuration that is not an object', 'tr'],
    ['words that are not an object', { lexicon: { words: [] } }],
    ['a word entry that is not an object', { lexicon: { words: { kitap: true } } }],
    ['readings that are not an object', { lexicon: { readings: 'nato' } }],
    ['a reading that is not a string', { lexicon: { readings: { NATO: 5 } } }],
    ['a reading entry without a reading', { lexicon: { readings: { NATO: { kind: 'proper' } } } }],
    [
      'a reading entry with an unknown kind',
      { lexicon: { readings: { NATO: { reading: 'nato', kind: 'x' } } } },
    ],
    ['defaults with an unknown kind', { defaults: { kind: 'name' } }],
  ])('rejects %s', (_, config) => {
    expect(codeOf(() => createInflector(config as InflectorConfig))).toBe('INVALID_ARGUMENT');
  });
});
