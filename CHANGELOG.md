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
  the ordinal suffix, the copula `-dır` and the question particle (also carrying the copula:
  kitap mıdır), alone or chained.
- Vowel harmony, buffer letters, d/t assimilation, softening, vowel drop (kept in
  reduplications such as şehirden şehire) and consonant doubling, with apostrophes for proper
  nouns, numbers, abbreviations and letters per the TDK spelling guide.
- Reading of numbers (integers up to 10^21 − 1, decimals, negatives, percentages, fractions,
  powers written with superscripts, clock times), abbreviations (Turkish letter names or known
  acronyms), lower-case symbols, superscript units (m²ye) and dotted abbreviations.
- `numberToWords` (with `virgül` or `tam` decimals) and `ordinal`.
- `format` with `{name:suffix+suffix}` placeholders (identifiers in any script, dotted names)
  and the `tr` tagged template, which recognises possessives, the pronominal n of compounds and
  the person and tense endings of the question particle.
- `createInflector` with lexicon additions and defaults; reading entries with a `kind`, word
  entries with a `ki` flag; `DEFAULT_LEXICON` (deeply frozen), `analyze`.
- `toUpper`, `toLower`, `capitalize` with Turkish casing rules, without ICU.
- `InflectError` with machine-readable codes, including `INVALID_ARGUMENT` for calls from
  JavaScript with wrong argument types.
- Examples for i18next (formatters, and a post-processor that escapes braces in interpolated
  values) and FormatJS (rich-text tags).

[Unreleased]: https://github.com/aozmekik/turkish-inflect/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aozmekik/turkish-inflect/releases/tag/v0.1.0
