import { describe, expect, it } from 'vitest';

import { createInflector, inflect, toUpper } from '../src/index.js';
import { render, soundOf, template, vowelStem } from '../src/phonology.js';

describe('template', () => {
  it('parses archiphoneme notation', () => {
    expect(template('(y)A')).toEqual([{ kind: 'buffer', letter: 'y' }, { kind: 'A' }]);
    expect(template('(I)ncI')).toEqual([{ kind: 'linking' }, { kind: 'literal', text: 'nc' }, { kind: 'I' }]);
    expect(template(' mI')).toEqual([{ kind: 'literal', text: ' m' }, { kind: 'I' }]);
  });

  it.each(['(x)A', 'DAn!', 'AX'])('rejects the malformed template %j', (source) => {
    expect(() => template(source)).toThrow(/Malformed suffix template/u);
  });
});

describe('render', () => {
  const after = (word: string, front = false) => {
    const sound = soundOf(word, front);
    if (sound === undefined) throw new Error('no vowel');
    return sound;
  };

  it('chooses buffers, linking vowels, harmony and voicing', () => {
    expect(render(template('(y)A'), after('araba')).text).toBe('ya');
    expect(render(template('(y)A'), after('ev')).text).toBe('e');
    expect(render(template('(I)m'), after('kapı')).text).toBe('m');
    expect(render(template('(I)m'), after('göz')).text).toBe('üm');
    expect(render(template('DAn'), after('kitap')).text).toBe('tan');
    expect(render(template('DAn'), after('saat', true)).text).toBe('ten');
    expect(render(template('lArI'), after('saat', true)).text).toBe('leri');
  });

  it('gives su its y before a vowel, a buffer or a linking vowel only', () => {
    const su = { ...after('su'), bufferY: true };
    expect(render(template('(I)m'), su).text).toBe('yum');
    expect(render(template('(n)In'), su).text).toBe('yun');
    expect(render(template('(y)lA'), su).text).toBe('yla');
    expect(render(template('I'), su).text).toBe('yu');
    expect(render(template('DA'), su).text).toBe('da');
    expect(render(template('lAr'), su).text).toBe('lar');
    expect(render(template(' mI'), su).text).toBe(' mu');
    expect(render(template(''), su).text).toBe('');
  });

  it('reports the sound after the suffix', () => {
    expect(render(template('DA'), after('ev')).sound).toEqual({
      lastVowel: 'e',
      endsInVowel: true,
      voiceless: false,
      front: false,
      bufferY: false,
    });
  });

  it('returns no sound for a word without vowels', () => {
    expect(soundOf('brr')).toBeUndefined();
  });
});

describe('vowelStem', () => {
  it('leaves letters that cannot soften alone, even when told to soften', () => {
    expect(vowelStem('pilav', { soften: true }, 2)).toBe('pilav');
    const custom = createInflector({ lexicon: { words: { pilav: { soften: true } } } });
    expect(custom.inflect('pilav', 'accusative')).toBe('pilavı');
  });

  it('keeps the case of the softened letter', () => {
    expect(vowelStem('KİTAP', undefined, 2)).toBe('KİTAB');
    expect(inflect('KİTAP', 'accusative', { kind: 'common' })).toBe('KİTABı');
    expect(toUpper(inflect('KİTAP', 'accusative', { kind: 'common' }))).toBe('KİTABI');
  });

  it('drops a vowel in either case and with a circumflex', () => {
    expect(vowelStem('ŞEHİR', { dropVowel: true }, 2)).toBe('ŞEHR');
    expect(vowelStem('kâbir', { dropVowel: true }, 2)).toBe('kâbr');
  });

  it('does not soften k or g after a consonant other than n', () => {
    expect(vowelStem('kiosk', undefined, 2)).toBe('kiosk');
    expect(vowelStem('bowling', undefined, 2)).toBe('bowling');
    expect(vowelStem('renk', { soften: true }, 1)).toBe('reng');
  });
});
