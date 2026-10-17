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

## Consequences

- Wrong input is found during development, with an actionable message.
- A property test asserts that no input, however malformed, throws anything other than
  `InflectError`.
- Applications that interpolate arbitrary user data should wrap calls or use an integration
  layer with a fallback, as the examples show.
