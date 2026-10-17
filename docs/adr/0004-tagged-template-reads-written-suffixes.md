# ADR 0004: The tagged template re-inflects the suffix the author wrote

- Status: accepted
- Date: 2026-10-18

## Context

`format('{name:dative}', ...)` is explicit but reads unlike Turkish. A tagged template can be
closer to the text a translator would write. The question is how the author marks the suffix.

## Options considered

1. **A marker syntax**, for example tr`${name}{dative}`. Unambiguous, but the template no longer
   reads as Turkish.
2. **Wrapper calls**, for example tr`${dative(name)}`. Needs no tag at all.
3. **Write the suffix as it would appear for any value**, for example tr`${name}'e gönderildi`,
   and let the tag recognise "'e" as the dative and re-inflect it for the actual value.

## Decision

Option 3. The recogniser is generated from the suffix templates themselves: every surface form
of every suffix under every phonological state is enumerated at start-up, and the letters after
an interpolation are split into a valid chain by a small backtracking search ("'daki" →
locative + ki, "'lerden" → plural + ablative). A following " mi" is treated as the question
particle. An apostrophe followed by letters that are not a suffix chain throws
`TEMPLATE_SYNTAX`; bare letters that are not a suffix are left alone.

## Consequences

- Templates read naturally and keep working when the sample value changes.
- Some written forms are ambiguous; -ı/-i after a consonant is both accusative and 3rd-person
  possessive, and is read as accusative. Possessives of other persons are not recognised (they
  collide with the genitive), and the tag cannot infer `compound: true`; per-value options
  cover both: tr`${{ value, compound: true }}'ne`.
- The marker grammar can never drift from the inflection rules, because it is derived from them.
