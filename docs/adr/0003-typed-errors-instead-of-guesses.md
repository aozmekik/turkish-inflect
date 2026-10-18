# ADR 0003: Throw a typed error instead of guessing

- Status: accepted
- Date: 2026-10-18

## Context

Some values cannot be read: "C++" ends in symbols, "Xyz." is an unknown dotted abbreviation,
"8." is an ordinal that TDK says takes no suffix, a reading may contain no vowel. Some
requests are ungrammatical: two case suffixes, a plural after a case. A UI helper is tempted to
return something anyway so that the screen never breaks.

## Options considered

1. **Best-effort output.** Return the value with some default suffix. The UI never breaks, but
   wrong Turkish ships silently and nobody learns that the value needs a `reading`.
2. **Return `undefined` or a result object.** Forces every call site to branch, which is noisy
   for a function used inside templates.
3. **Throw `InflectError` with a machine-readable `code`, and let integrations decide.**

## Decision

Option 3. `inflect`, `format` and `tr` throw `InflectError` with one of a small set of codes
(`UNREADABLE`, `INVALID_SUFFIX_ORDER`, `UNSUPPORTED`, ...) and a message that says how to fix the
input. Integration layers that must never fail, such as the i18next post-processor in
`examples/i18next.ts`, catch the error and fall back to the uninflected value.

Two refinements keep the error for the cases where a guess would really be made:

- A value that takes no suffix is never analysed: `format('Dil: {lang}')` writes "C++", an
  emoji or an empty string as it is, because nothing has to be inferred from its sound.
- Arguments are checked at the public boundary. A call from JavaScript with the wrong type, or an
  option with an unknown value (`kind: 'foo'`), throws `INVALID_ARGUMENT` instead of a
  `TypeError` from deep inside the library or a silently different reading.

## Consequences

- Wrong input is found during development, with an actionable message.
- Property tests assert that no input, however malformed, makes any public function throw
  anything other than `InflectError`: fast-check feeds arbitrary values (`fc.anything()`) as the
  value, the suffixes, the options and the template of `inflect`, `format`, `tr`,
  `numberToWords` and the casing helpers.
- Applications that interpolate arbitrary user data should wrap calls or use an integration
  layer with a fallback, as the examples show.
