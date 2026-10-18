/**
 * Templates: `format` with named placeholders and the `tr` tagged template.
 * Run with `npm run build && node examples/templates.ts`.
 */
import assert from 'node:assert/strict';

import { format, tr } from 'turkish-inflect';

const message = '{name:dative} bir mesaj gönderildi';
for (const name of ['Ayşe', 'Ahmet', 'İstanbul', 2026, 'TBMM']) {
  console.log(format(message, { name }));
}
assert.equal(format(message, { name: 'TBMM' }), "TBMM'ye bir mesaj gönderildi");

// Chains with "+", per-value options, literal braces.
assert.equal(format('{city:locative+ki} ofis', { city: 'Ankara' }), "Ankara'daki ofis");
assert.equal(
  format('{label:locative} indirim', { label: { value: 'Elektronik', kind: 'common' } }),
  'Elektronikte indirim',
);
assert.equal(format('{{literal}} {n:genitive}', { n: 'Ali' }), "{literal} Ali'nin");

// The tagged template rewrites whatever suffix follows the value, so templates read naturally.
const user = 'Ahmet';
const city = 'İzmir';
assert.equal(tr`${user}'e ${city}'dan bir paket geldi`, "Ahmet'e İzmir'den bir paket geldi");
assert.equal(tr`${'Ayşe'}'e ${'Bolu'}'dan bir paket geldi`, "Ayşe'ye Bolu'dan bir paket geldi");
assert.equal(tr`${'kitap'}'ı sepete ekle`, 'kitabı sepete ekle');
assert.equal(tr`Toplantı ${2026}'da ${'İzmir'} mı?`, "Toplantı 2026'da İzmir mi?");
assert.equal(tr`${'hesap'}ınızdan ödendi`, 'hesabınızdan ödendi');
assert.equal(tr`${'Kurtuluş Savaşı'}'ndan sonra`, "Kurtuluş Savaşı'ndan sonra");
assert.equal(tr`${'Bolu'} misiniz?`, 'Bolu musunuz?');

// Values without a suffix are written as they are, even when they cannot be read aloud.
assert.equal(format('Dil: {lang}', { lang: 'C++' }), 'Dil: C++');

console.log('templates: ok');
