import { describe, expect, it } from 'vitest';

import { capitalize, toLower, toUpper } from '../src/index.js';

describe('toUpper', () => {
  it.each([
    ['istanbul', 'İSTANBUL'],
    ['ılık', 'ILIK'],
    ['iğdır ılıca', 'İĞDIR ILICA'],
    ['çğıöşü', 'ÇĞIÖŞÜ'],
    ['şişli', 'ŞİŞLİ'],
    ['Straße', 'STRASSE'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(toUpper(input)).toBe(expected);
  });
});

describe('toLower', () => {
  it.each([
    ['İSTANBUL', 'istanbul'],
    ['ILIK', 'ılık'],
    ['IĞDIR İZMİR', 'ığdır izmir'],
    ['ÇĞIÖŞÜ', 'çğıöşü'],
    ['DİYARBAKIR', 'diyarbakır'],
    ['İZMİR', 'izmir'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(toLower(input)).toBe(expected);
  });

  it('never produces the combining dot that the default mapping adds to İ', () => {
    expect('İ'.toLowerCase()).toBe('i̇');
    expect(toLower('İ')).toBe('i');
  });
});

describe('capitalize', () => {
  it.each([
    ['ırmak', 'Irmak'],
    ['istanbul', 'İstanbul'],
    ['İSTANBUL', 'İstanbul'],
    ['IŞIK', 'Işık'],
    ['ç', 'Ç'],
    ['', ''],
    ['😀abc', '😀abc'],
  ])('%j → %j', (input, expected) => {
    expect(capitalize(input)).toBe(expected);
  });
});
