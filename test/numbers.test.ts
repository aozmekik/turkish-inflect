import { describe, expect, it } from 'vitest';

import { InflectError, inflect, numberToWords, ordinal } from '../src/index.js';

describe('numberToWords', () => {
  it.each([
    [0, 'sıfır'],
    [1, 'bir'],
    [2, 'iki'],
    [3, 'üç'],
    [4, 'dört'],
    [5, 'beş'],
    [6, 'altı'],
    [7, 'yedi'],
    [8, 'sekiz'],
    [9, 'dokuz'],
    [10, 'on'],
    [11, 'on bir'],
    [19, 'on dokuz'],
    [20, 'yirmi'],
    [30, 'otuz'],
    [40, 'kırk'],
    [50, 'elli'],
    [60, 'altmış'],
    [70, 'yetmiş'],
    [80, 'seksen'],
    [90, 'doksan'],
    [99, 'doksan dokuz'],
    [100, 'yüz'],
    [101, 'yüz bir'],
    [110, 'yüz on'],
    [200, 'iki yüz'],
    [365, 'üç yüz altmış beş'],
    [999, 'dokuz yüz doksan dokuz'],
    [1000, 'bin'],
    [1001, 'bin bir'],
    [1100, 'bin yüz'],
    [1251, 'bin iki yüz elli bir'],
    [2000, 'iki bin'],
    [2026, 'iki bin yirmi altı'],
    [10_000, 'on bin'],
    [101_000, 'yüz bir bin'],
    [999_999, 'dokuz yüz doksan dokuz bin dokuz yüz doksan dokuz'],
    [1_000_000, 'bir milyon'],
    [1_001_000, 'bir milyon bin'],
    [1_100_000, 'bir milyon yüz bin'],
    [2_000_000, 'iki milyon'],
    [1_000_000_000, 'bir milyar'],
    [1_000_000_000_000, 'bir trilyon'],
    [1e15, 'bir katrilyon'],
    [1e18, 'bir kentilyon'],
  ])('%d → %j', (input, expected) => {
    expect(numberToWords(input)).toBe(expected);
  });

  it('reads the examples of the TDK spelling guide', () => {
    expect(numberToWords(200)).toBe('iki yüz');
    expect(numberToWords(365)).toBe('üç yüz altmış beş');
    expect(numberToWords(1251)).toBe('bin iki yüz elli bir');
    expect(numberToWords('15,2', { decimal: 'tam' })).toBe('on beş tam onda iki');
    expect(numberToWords('5,26', { decimal: 'tam' })).toBe('beş tam yüzde yirmi altı');
  });

  it('reads the largest supported integer', () => {
    expect(numberToWords(10n ** 21n - 1n)).toBe(
      'dokuz yüz doksan dokuz kentilyon dokuz yüz doksan dokuz katrilyon dokuz yüz doksan dokuz trilyon ' +
        'dokuz yüz doksan dokuz milyar dokuz yüz doksan dokuz milyon dokuz yüz doksan dokuz bin dokuz yüz doksan dokuz',
    );
  });

  it.each([
    [-5, 'eksi beş'],
    [-0, 'sıfır'],
    [-3.5, 'eksi üç virgül beş'],
    [0.1, 'sıfır virgül bir'],
    [3.05, 'üç virgül sıfır beş'],
    [1e-7, 'sıfır virgül sıfır sıfır sıfır sıfır sıfır sıfır bir'],
    [-2.5e-7, 'eksi sıfır virgül sıfır sıfır sıfır sıfır sıfır sıfır yirmi beş'],
    [123.456, 'yüz yirmi üç virgül dört yüz elli altı'],
  ])('reads the JavaScript number %d as %j', (input, expected) => {
    expect(numberToWords(input)).toBe(expected);
  });

  it.each([
    [
      12345678901234567890n,
      'on iki kentilyon üç yüz kırk beş katrilyon altı yüz yetmiş sekiz trilyon dokuz yüz bir milyar iki yüz otuz dört milyon beş yüz altmış yedi bin sekiz yüz doksan',
    ],
    [-42n, 'eksi kırk iki'],
    [0n, 'sıfır'],
  ])('reads the bigint %s', (input, expected) => {
    expect(numberToWords(input)).toBe(expected);
  });

  it.each([
    ['1.000.000', 'bir milyon'],
    ['1.234.567,89', 'bir milyon iki yüz otuz dört bin beş yüz altmış yedi virgül seksen dokuz'],
    ['42', 'kırk iki'],
    ['007', 'yedi'],
    [' 12 ', 'on iki'],
    ['+3', 'üç'],
    ['-3,50', 'eksi üç virgül elli'],
    ['−7', 'eksi yedi'],
    ['-0,0', 'sıfır virgül sıfır'],
    ['3,00', 'üç virgül sıfır sıfır'],
  ])('reads the Turkish-notation string %j', (input, expected) => {
    expect(numberToWords(input)).toBe(expected);
  });

  it.each([
    ['3,05', 'üç tam yüzde beş'],
    ['0,001', 'sıfır tam binde bir'],
    ['1,2345', 'bir tam on binde iki bin üç yüz kırk beş'],
    ['1,23456', 'bir tam yüz binde yirmi üç bin dört yüz elli altı'],
    ['1,000001', 'bir tam milyonda bir'],
    ['-2,5', 'eksi iki tam onda beş'],
  ])('reads %j as a fraction with decimal: "tam"', (input, expected) => {
    expect(numberToWords(input, { decimal: 'tam' })).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects the non-finite number %d',
    (input) => {
      expect(() => numberToWords(input)).toThrow(expect.objectContaining({ code: 'INVALID_NUMBER' }));
    },
  );

  it.each(['', 'abc', '1,2,3', '12.34', '1.2345', '1 000', '3.5', ',5', '5,'])(
    'rejects the malformed string %j',
    (input) => {
      expect(() => numberToWords(input)).toThrow(InflectError);
      expect(() => numberToWords(input)).toThrow(expect.objectContaining({ code: 'INVALID_NUMBER' }));
    },
  );

  it('rejects integers of 10^21 and more', () => {
    expect(() => numberToWords(10n ** 21n)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => numberToWords(1e21)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
  });
});

describe('ordinal', () => {
  it.each([
    [0, 'sıfırıncı'],
    [1, 'birinci'],
    [2, 'ikinci'],
    [3, 'üçüncü'],
    [4, 'dördüncü'],
    [5, 'beşinci'],
    [6, 'altıncı'],
    [7, 'yedinci'],
    [8, 'sekizinci'],
    [9, 'dokuzuncu'],
    [10, 'onuncu'],
    [20, 'yirminci'],
    [30, 'otuzuncu'],
    [40, 'kırkıncı'],
    [50, 'ellinci'],
    [60, 'altmışıncı'],
    [70, 'yetmişinci'],
    [80, 'sekseninci'],
    [90, 'doksanıncı'],
    [100, 'yüzüncü'],
    [101, 'yüz birinci'],
    [1000, 'bininci'],
    [2026, 'iki bin yirmi altıncı'],
    [1_000_000, 'bir milyonuncu'],
    [1_000_000_000, 'bir milyarıncı'],
  ])('%d → %j', (input, expected) => {
    expect(ordinal(input)).toBe(expected);
  });

  it.each([
    ['3.', 'üçüncü'],
    ['40.', 'kırkıncı'],
    ['1.000.', 'bininci'],
    ['14', 'on dördüncü'],
    [24n, 'yirmi dördüncü'],
  ])('reads %s', (input, expected) => {
    expect(ordinal(input)).toBe(expected);
  });

  it.each([-1, 2.5, '3,5', -1n])('rejects %s', (input) => {
    expect(() => ordinal(input)).toThrow(expect.objectContaining({ code: 'INVALID_NUMBER' }));
  });
});

describe('numerals inside values', () => {
  it('reads malformed fractions and repeated separators group by group', () => {
    expect(inflect('1.2/3', 'dative')).toBe("1.2/3'e");
    expect(inflect('1..2', 'dative')).toBe("1..2'ye");
  });
});
