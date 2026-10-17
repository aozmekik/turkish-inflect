# ADR 0001: Choose suffixes from the spoken form of a value

- Status: accepted
- Date: 2026-10-18

## Context

A Turkish suffix depends on how the end of a word sounds: its last vowel (vowel harmony),
whether it ends in a vowel (buffer letters) and whether that final sound is voiceless
(d → t). The TDK spelling guide applies the same principle to things that are not plain
words: numbers follow their reading (1985'te, because "bin dokuz yüz seksen beş" ends in
"beş"), capital-letter abbreviations follow the name of their last letter (TDK'den: "te de
ke"), acronyms read as words follow that reading (NATO'dan), lower-case symbols and dotted
abbreviations follow the full word (kg'dan, Alm.dan), and letters follow their names
(a'dan z'ye).

The values a UI interpolates are a mix of all of these: names, cities, years, prices,
percentages, product codes ("iPhone 15", "COVID-19"), abbreviations and common nouns.

## Options considered

1. **A rule table per value type.** For example, map the last digit of a number to a suffix
   form, the last letter of an abbreviation to another. Small, but every type needs its own
   tables, the tables have to encode harmony and voicing by hand, and cases like 1.000.000
   (milyon), 40 (kırk), 1/2 (bölü iki) or 17.30 (otuz) need special rules of their own.
2. **A full morphological analyser** (in the style of Zemberek or TRmorph). Handles arbitrary
   words, but is far larger than a UI helper should be, needs a dictionary, and still does not
   know how to read numbers or abbreviations aloud.
3. **Normalise every value to the spoken form of its end, then run one phonology.** Numbers are
   converted to words, abbreviations to letter names, symbols to their word, and words are
   normalised to Turkish letters. One suffix renderer, working on archiphoneme templates such
   as `(y)A` and `DAn`, then serves every kind of value.

## Decision

Option 3. `analyze` turns a value into `{ kind, reading, apostrophe }` plus the phonological
state of the last spoken word; `inflect` renders the suffix chain from that state and writes it
after the unchanged value (or after the changed stem, for common nouns).

## Consequences

- Adding a new kind of value means teaching the analysis how it is read, not writing new
  suffix tables. Clock times, fractions and percentages were each a few lines.
- The reading is inspectable (`analyze('TBMM').reading === 'te be me me'`), which makes wrong
  results easy to explain and fix, and the `reading` option is a single escape hatch for any
  value whose pronunciation cannot be derived (Shakespeare → "şekspir", C++ → "si plas plas").
- `numberToWords` comes for free as a public function, and property tests can check that the
  suffix after digits equals the suffix after the last number word.
- Every call does a little more work than a table lookup (normalising the value and reading
  numbers in full); the measured cost is a few microseconds per call (README.md, Benchmarks),
  which is negligible for UI strings.
