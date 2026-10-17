# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Until 1.0.0, minor versions may
contain breaking changes.

## [Unreleased]

## [0.1.0] - 2026-10-18

### Added

- `inflect(value, suffixes, options)` for case suffixes (accusative, dative, locative, ablative,
  genitive, instrumental), the separate `ile`, plural, possessives for every person, `-ki`,
  the ordinal suffix, the copula `-dır` and the question particle, alone or chained.
- Vowel harmony, buffer letters, d/t assimilation, softening, vowel drop and consonant doubling,
  with apostrophes for proper nouns, numbers, abbreviations and letters per the TDK spelling guide.
- Reading of numbers (integers up to 10^21 − 1, decimals, negatives, percentages, fractions, clock
  times), abbreviations (Turkish letter names or known acronyms), lower-case symbols and dotted
  abbreviations.
- `numberToWords` (with `virgül` or `tam` decimals) and `ordinal`.
- `format` with `{name:suffix+suffix}` placeholders and the `tr` tagged template.
- `createInflector` with lexicon additions and defaults, `DEFAULT_LEXICON`, `analyze`.
- `toUpper`, `toLower`, `capitalize` with Turkish casing rules, without ICU.
- `InflectError` with machine-readable codes.
- Examples for i18next (post-processor and formatters) and FormatJS (rich-text tags).
