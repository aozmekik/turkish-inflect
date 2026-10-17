/**
 * FormatJS / ICU MessageFormat integration with rich-text tags: wrap the argument in a tag
 * named after the suffix and map each tag to `inflect`. The same tag functions work with
 * react-intl's `<FormattedMessage values={...}>`.
 * Run with `npm run build && node examples/formatjs.ts`.
 */
import assert from 'node:assert/strict';

import { IntlMessageFormat } from 'intl-messageformat';
import { type Suffix, inflect } from 'turkish-inflect';

/** Tag functions for the suffixes used in the messages below. */
function suffixTags(...suffixes: Suffix[]): Record<string, (chunks: unknown[]) => string> {
  return Object.fromEntries(
    suffixes.map((suffix) => [suffix, (chunks: unknown[]) => inflect(chunks.join(''), suffix)]),
  );
}

const tags = suffixTags('dative', 'genitive', 'locative');

const sent = new IntlMessageFormat('<dative>{name}</dative> bir mesaj gönderildi', 'tr');
assert.equal(sent.format({ name: 'Ayşe', ...tags }), "Ayşe'ye bir mesaj gönderildi");
assert.equal(sent.format({ name: 'Ahmet', ...tags }), "Ahmet'e bir mesaj gönderildi");

// ICU plural and number formatting still work around the inflected argument.
const files = new IntlMessageFormat(
  '<genitive>{owner}</genitive> {count, plural, =0 {hiç dosyası yok} other {# dosyası var}}',
  'tr',
);
assert.equal(files.format({ owner: 'Ali', count: 3, ...tags }), "Ali'nin 3 dosyası var");
assert.equal(files.format({ owner: 'NATO', count: 0, ...tags }), "NATO'nun hiç dosyası yok");

const year = new IntlMessageFormat('Etkinlik <locative>{year}</locative> yapılacak', 'tr');
assert.equal(year.format({ year: 2026, ...tags }), "Etkinlik 2026'da yapılacak");
console.log(year.format({ year: 2027, ...tags }));

console.log('formatjs: ok');
