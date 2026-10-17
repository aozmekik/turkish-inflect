import { describe, expect, it } from 'vitest';

import { InflectError, createInflector, format, tr } from '../src/index.js';
import { parseSuffixMarker } from '../src/template.js';

describe('format', () => {
  it('fills placeholders with inflected values', () => {
    expect(format('{name:dative} bir mesaj gönderildi', { name: 'Ayşe' })).toBe(
      "Ayşe'ye bir mesaj gönderildi",
    );
    expect(format('{name:dative} bir mesaj gönderildi', { name: 'Ahmet' })).toBe(
      "Ahmet'e bir mesaj gönderildi",
    );
    expect(format('{name:dative} bir mesaj gönderildi', { name: 'İstanbul' })).toBe(
      "İstanbul'a bir mesaj gönderildi",
    );
    expect(format('{name:dative} bir mesaj gönderildi', { name: 2026 })).toBe("2026'ya bir mesaj gönderildi");
    expect(format('{name:dative} bir mesaj gönderildi', { name: 'TBMM' })).toBe(
      "TBMM'ye bir mesaj gönderildi",
    );
    expect(format('{name:dative} eklendi', { name: 'kitap' })).toBe('kitaba eklendi');
  });

  it('supports chains, several placeholders and plain placeholders', () => {
    expect(format('{city:locative+ki} ofis', { city: 'İzmir' })).toBe("İzmir'deki ofis");
    expect(format('{a:genitive} ve {b:genitive} {n} dosyası', { a: 'Ali', b: 'Veli', n: 3 })).toBe(
      "Ali'nin ve Veli'nin 3 dosyası",
    );
    expect(format('{ name : plural + ablative }', { name: 'Ahmet' })).toBe('Ahmetlerden');
    expect(format('{x}', { x: 3.5 })).toBe('3,5');
    expect(format('no placeholders', {})).toBe('no placeholders');
    expect(format('', {})).toBe('');
  });

  it('takes per-value and per-call options', () => {
    expect(format('{c:locative}', { c: { value: 'Elektronik', kind: 'common' } })).toBe('Elektronikte');
    expect(format('{c:locative}', { c: 'Elektronik' })).toBe("Elektronik'te");
    expect(format('{n:dative}', { n: 'Ayşe' }, { apostrophe: '’' })).toBe('Ayşe’ye');
    expect(format('{n:dative}', { n: { value: 'Ayşe', apostrophe: '`' } }, { apostrophe: '’' })).toBe(
      'Ayşe`ye',
    );
    expect(format('{u:dative}', { u: { value: 'Avrupa Birliği', compound: true } })).toBe(
      "Avrupa Birliği'ne",
    );
  });

  it('handles escaped braces', () => {
    expect(format('{{literal}} {name:dative} }}', { name: 'Ali' })).toBe("{literal} Ali'ye }");
  });

  it.each([
    ['{name', 'TEMPLATE_SYNTAX'],
    ['name}', 'TEMPLATE_SYNTAX'],
    ['{}', 'TEMPLATE_SYNTAX'],
    ['{1abc}', 'TEMPLATE_SYNTAX'],
    ['{name:}', 'TEMPLATE_SYNTAX'],
    ['{name:dative+}', 'TEMPLATE_SYNTAX'],
    ['{name:dat{ive}', 'TEMPLATE_SYNTAX'],
    ['{missing}', 'MISSING_VALUE'],
    ['{toString}', 'MISSING_VALUE'],
    ['{undef}', 'MISSING_VALUE'],
    ['{name:nominative}', 'INVALID_SUFFIX'],
  ])('rejects %j with %s', (template, code) => {
    const values = { name: 'Ali', undef: undefined } as unknown as Record<string, string>;
    expect(() => format(template, values)).toThrow(expect.objectContaining({ code }));
    expect(() => format(template, values)).toThrow(InflectError);
  });
});

describe('tr', () => {
  it('re-inflects the suffix written after each value', () => {
    expect(tr`${'Ayşe'}'e mesaj gönderildi`).toBe("Ayşe'ye mesaj gönderildi");
    expect(tr`${'Ahmet'}'e mesaj gönderildi`).toBe("Ahmet'e mesaj gönderildi");
    expect(tr`${'İstanbul'}'e mesaj gönderildi`).toBe("İstanbul'a mesaj gönderildi");
    expect(tr`${2026}'e mesaj gönderildi`).toBe("2026'ya mesaj gönderildi");
    expect(tr`${'TBMM'}'e mesaj gönderildi`).toBe("TBMM'ye mesaj gönderildi");
    expect(tr`${'kitap'}'e mesaj gönderildi`).toBe('kitaba mesaj gönderildi');
  });

  it.each([
    ["'yi", 'Ali', "Ali'yi"],
    ["'ı", 'kitap', 'kitabı'],
    ["'da", 'İzmir', "İzmir'de"],
    ["'dan", 'Sivas', "Sivas'tan"],
    ["'nin", 'Ahmet', "Ahmet'in"],
    ["'la", 'Ayşe', "Ayşe'yle"],
    ["'si", 'Ahmet', "Ahmet'i"],
    ["'ler", 'Ahmet', 'Ahmetler'],
    ["'dir", 'Ankara', "Ankara'dır"],
    ["'daki", '2026', "2026'daki"],
    ["'ninki", 'Ahmet', "Ahmet'inki"],
    ["'lerden", 'Ayşe', 'Ayşelerden'],
    ["'ları", 'Ahmet', 'Ahmetleri'],
    ["'inci", '56', "56'ncı"],
    ["'üncüye", '3', "3'üncüye"],
    ["'ndan", 'Kurtuluş Savaşı', "Kurtuluş Savaşı'dan"],
  ])('reads %j after %j', (marker, value, expected) => {
    const strings = Object.assign([`<`, `${marker}>`], { raw: [`<`, `${marker}>`] });
    expect(tr(strings, value)).toBe(`<${expected}>`);
  });

  it('accepts suffixes written without an apostrophe', () => {
    expect(tr`${'kitap'}a ekle`).toBe('kitaba ekle');
    expect(tr`${'ev'}lerden`).toBe('evlerden');
    expect(tr`${'Ali'}ye`).toBe("Ali'ye");
  });

  it('leaves text that is not a suffix alone', () => {
    expect(tr`${5}x hızlı`).toBe('5x hızlı');
    expect(tr`${'Ali'} ile`).toBe('Ali ile');
    expect(tr`${'Ali'}`).toBe('Ali');
    expect(tr`${'Ali'}' dedi`).toBe("Ali' dedi");
    expect(tr`${3.5} kg`).toBe('3,5 kg');
    expect(tr`plain`).toBe('plain');
  });

  it('adjusts the question particle', () => {
    expect(tr`${'İzmir'} mı?`).toBe('İzmir mi?');
    expect(tr`${'Bolu'} mi?`).toBe('Bolu mu?');
    expect(tr`${2026}'da ${'İzmir'} mı?`).toBe("2026'da İzmir mi?");
    expect(tr`${'ev'}de mi?`).toBe('evde mi?');
    expect(tr`${'Ali'} mimar`).toBe('Ali mimar');
  });

  it('keeps the apostrophe the template uses', () => {
    expect(tr`${'Ayşe'}’e`).toBe('Ayşe’ye');
    expect(tr`${'Ayşe'}’e`).toBe('Ayşe’ye');
  });

  it('takes per-value options', () => {
    expect(tr`${{ value: 'Elektronik', kind: 'common' }}'te`).toBe('Elektronikte');
    expect(tr`${{ value: 'Avrupa Birliği', compound: true }}'ne`).toBe("Avrupa Birliği'ne");
    expect(tr`${{ value: 'Ayşe', apostrophe: '`' }}'e`).toBe('Ayşe`ye');
  });

  it('rejects an apostrophe followed by letters that are not suffixes', () => {
    expect(() => tr`${'Ali'}'xyz`).toThrow(expect.objectContaining({ code: 'TEMPLATE_SYNTAX' }));
  });

  it('works when destructured from an inflector', () => {
    const { tr: tag } = createInflector({ lexicon: { readings: { iPhone: 'ayfon' } } });
    expect(tag`${'iPhone'}'a`).toBe("iPhone'a");
  });

  it('falls back to the raw string for invalid escapes', () => {
    const strings = Object.assign([`<`, undefined as unknown as string], { raw: [`<`, `'e\\u`] });
    expect(tr(strings, 'Ali')).toBe("<Ali'ye\\u");
  });
});

describe('parseSuffixMarker', () => {
  it.each([
    ['e', ['dative']],
    ['ye', ['dative']],
    ['ı', ['accusative']],
    ['si', ['possessive3sg']],
    ['de', ['locative']],
    ['den', ['ablative']],
    ['nin', ['genitive']],
    ['yle', ['instrumental']],
    ['ler', ['plural']],
    ['tir', ['copula']],
    ['kü', ['ki']],
    ['ncı', ['ordinal']],
    ['deki', ['locative', 'ki']],
    ['dekiler', ['locative', 'ki', 'plural']],
    ['lerin', ['plural', 'genitive']],
    ['ları', ['plural', 'accusative']],
    ['ndan', ['ablative']],
  ])('%j → %j', (letters, expected) => {
    expect(parseSuffixMarker(letters)).toEqual(expected);
  });

  it.each(['', 'xyz', 'eler', 'dee', 'mi'])('rejects %j', (letters) => {
    expect(parseSuffixMarker(letters)).toBeUndefined();
  });
});
