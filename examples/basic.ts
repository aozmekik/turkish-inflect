/**
 * The core API: inflect any value, spell out numbers, and use Turkish casing.
 * Run with `npm run build && node examples/basic.ts`.
 */
import assert from 'node:assert/strict';

import { analyze, inflect, numberToWords, ordinal, toUpper } from 'turkish-inflect';

// Proper nouns take an apostrophe; the suffix follows vowel harmony.
for (const name of ['Ayşe', 'Ahmet', 'İstanbul', 'Bolu']) {
  console.log(`${inflect(name, 'dative')} bir mesaj gönderildi`);
}
assert.equal(inflect('Ayşe', 'dative'), "Ayşe'ye");
assert.equal(inflect('İstanbul', 'dative'), "İstanbul'a");

// Common nouns change their stem; proper nouns are not softened in writing.
assert.equal(inflect('kitap', 'accusative'), 'kitabı');
assert.equal(inflect('Tokat', 'accusative'), "Tokat'ı");

// Numbers follow how they are read: 2026 → "iki bin yirmi altı".
assert.equal(inflect(2026, 'dative'), "2026'ya");
assert.equal(inflect('1.000.000', 'locative'), "1.000.000'da");
assert.equal(numberToWords(2026), 'iki bin yirmi altı');
assert.equal(ordinal(3), 'üçüncü');
assert.equal(inflect(15, 'ordinal'), "15'inci");

// Abbreviations are read letter by letter unless they are known acronyms.
assert.equal(inflect('TBMM', 'dative'), "TBMM'ye");
assert.equal(inflect('NATO', 'dative'), "NATO'ya");
console.log(analyze('TBMM'));

// Chains: locative + ki, plural + ablative, possessive + dative.
assert.equal(inflect('İzmir', ['locative', 'ki']), "İzmir'deki");
assert.equal(inflect('Ahmet', ['plural', 'ablative']), 'Ahmetlerden');
assert.equal(inflect('hesap', ['possessive2pl', 'dative']), 'hesabınıza');

// Compound names that already end in a possessive take the pronominal n.
assert.equal(inflect('Avrupa Birliği', 'dative', { compound: true }), "Avrupa Birliği'ne");

// Turkish casing without ICU: i ↔ İ, ı ↔ I.
assert.equal(toUpper(inflect('istanbul', 'locative', { kind: 'proper' })), "İSTANBUL'DA");

console.log('basic: ok');
