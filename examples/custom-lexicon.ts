/**
 * Extending the lexicon: pronunciations for brand and foreign names, and words with
 * exceptional inflection. Run with `npm run build && node examples/custom-lexicon.ts`.
 */
import assert from 'node:assert/strict';

import { DEFAULT_LEXICON, InflectError, createInflector, inflect } from 'turkish-inflect';

// Spelling-based reading gets silent letters wrong (the final e is not pronounced) ...
assert.equal(inflect('Shakespeare', 'genitive'), "Shakespeare'nin");
// ... so give the pronunciation once, per call or for a whole inflector.
assert.equal(inflect('Shakespeare', 'genitive', { reading: 'şekspir' }), "Shakespeare'in");

const tr = createInflector({
  lexicon: {
    readings: {
      Shakespeare: 'şekspir',
      iPhone: 'ayfon',
      'C#': 'si şarp',
      BM: 'birleşmiş milletler',
      // A common noun whose spelling does not tell its pronunciation: no apostrophe.
      web: { reading: 'veb', kind: 'common' },
    },
    words: { hevenk: { soften: true }, pazartesi: { ki: true } },
  },
  defaults: { apostrophe: '’' },
});

assert.equal(tr.inflect('Shakespeare', 'genitive'), 'Shakespeare’in');
assert.equal(tr.inflect('Yeni iPhone', 'dative'), 'Yeni iPhone’a');
assert.equal(tr.inflect('C#', 'locative'), 'C#’ta');
assert.equal(tr.inflect('Yeni C#', 'dative'), 'Yeni C#’a');
assert.equal(tr.inflect('web', 'locative'), 'webde');
assert.equal(tr.inflect('pazartesi', 'ki'), 'pazartesiki');
assert.equal(tr.inflect('BM', 'dative'), 'BM’e');
assert.equal(tr.format('{lang:ablative} çeviri', { lang: 'C#' }), 'C#’tan çeviri');

// Unreadable values throw a typed error instead of guessing.
assert.throws(
  () => inflect('C++', 'dative'),
  (error: unknown) => error instanceof InflectError && error.code === 'UNREADABLE',
);

console.log(`${String(Object.keys(DEFAULT_LEXICON.words).length)} built-in word entries`);
console.log('custom-lexicon: ok');
