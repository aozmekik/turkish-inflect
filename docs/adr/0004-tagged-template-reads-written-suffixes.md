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
of every suffix under every phonological state is enumerated on the first call, and the letters
after an interpolation are split into a valid chain by a small backtracking search ("'daki" →
locative + ki, "'lerden" → plural + ablative, "ınızdan" → 2nd-person plural possessive +
ablative). A first suffix written with the pronominal n ("'ndan", "'nı") marks the value as a
compound, as if `compound: true` had been passed. A following " mi" is the question particle,
also with person and tense endings (" misin", " miydi", " midir"), which are re-harmonised with
the new particle.

Letters after an apostrophe, or letters with a vowel glued to an interpolation, that are not a
suffix chain throw `TEMPLATE_SYNTAX` rather than being copied into wrong Turkish
(tr`${'İzmir'}li` would otherwise give "Ankarali" for Ankara). Glued letters without a vowel are
units or symbols (5x, 100m, 10px) and are left alone.

## Consequences

- Templates read naturally and keep working when the sample value changes.
- Some written forms are ambiguous and are resolved by preference: -ı/-i after a consonant is
  read as accusative rather than 3rd-person possessive, -ın/-in as genitive rather than
  2nd-person possessive, -ları as plural + accusative rather than 3rd-person plural possessive.
  Per-value options override the inference: tr`${{ value, compound: false }}'nda`.
- "müdür" after a value is left alone, because it is also a noun (Ali müdür).
- A vowelless possessive glued to a value (tr`${x}m`) is left as written; the apostrophe form
  ('m) or the consonant form (ım) is recognised.
- The marker grammar can never drift from the inflection rules, because it is derived from them.
