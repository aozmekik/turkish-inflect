# ADR 0002: A curated lexicon on top of default heuristics

- Status: accepted
- Date: 2026-10-18

## Context

Several inflection rules are lexical: spelling does not tell which words follow them.

- Softening: kitap → kitabı but top → topu; kanat → kanadı but sepet → sepeti.
- Front harmony after a palatal final consonant: saat → saati, gol → golü, but kanal → kanalı.
- Vowel drop (ağız → ağzı) and consonant doubling (hak → hakkı).

The TDK spelling guide gives the rules with examples and lists many exceptions; TDK Güncel
Türkçe Sözlük records the behaviour of each headword in an inflection hint ("kitap, -bı").

## Options considered

1. **Ship a full dictionary.** Correct for every listed word, but tens of thousands of entries
   would make the package many times larger than its code, and the dictionary's data is not
   ours to redistribute.
2. **Heuristics only.** Tiny, but wrong for very common words (saat, top, sepet, şehir).
3. **Heuristics for the default, plus a curated exception list, extensible by users.**

## Decision

Option 3. The defaults are chosen so that the exception lists stay short:

- p, ç, k and g soften in words of two or more syllables (kitap, ağaç, çocuk, katalog), and
  never in one-syllable words (top, saç, ok);
- words ending in -t do not soften by default (devlet, paket, bilet, internet), because Arabic
  and European loans ending in -t are the majority in UI vocabulary; native and -d loans that do
  soften (kanat, geçit, umut, metot, standart) are listed;
- everything else follows the regular rules.

The lexicon (215 word entries in 0.1.0) lists the exceptions to those defaults, each taken from
the TDK spelling guide or confirmed against the dictionary's inflection hint. An opt-in check,
`npm run check:tdk`, compares the accusative the library produces for every lexicon word and
every common noun in the test corpus with the dictionary's hint. `createInflector({ lexicon })`
adds or overrides entries, and `DEFAULT_LEXICON` exposes the built-in lists.

## Consequences

- The package stays small: under 9 KiB minified and gzipped, lexicon included (README.md, Size).
- Words outside the lexicon fall back to the heuristics and can be wrong; this is documented
  under Limitations and fixable per application without a release.
- Homographs get one entry (boyun → boynu "neck", not boy-un "your height"); the reading of
  the more common noun was chosen.
- The TDK check needs network access and is not part of CI; it is a maintenance tool for when
  the lexicon changes.
