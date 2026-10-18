# ADR 0005: Scan values in linear time

- Status: accepted
- Date: 2026-10-18

## Context

Everything the library needs is at the end of a value: the last word, the trailing numeral, an
abbreviation before a final period. The first implementation found these with end-anchored
regular expressions such as `/(?:\p{L}\p{M}*)+$/u`. When such a pattern does not match at the
end, the engine retries it from every earlier position, so the cost grows with the square of the
length. `node bench/long-input.ts` against a build of that implementation (commit 83d406e), on an
Apple M1 Pro (16 GB) with Node.js 22.22.3, took 2,907 ms for 40,000 letters followed by "!",
4,445 ms for 40,000 digits followed by "!" and 1,331 ms for "1." repeated 20,000 times. The
values are user data (display names, product titles) and are often inflected during server-side
rendering, so a long string could block the event loop (CWE-1333).

## Options considered

1. **Cap the input length** and keep the regular expressions. Simple, but any cap is arbitrary,
   and a value just under it is still slow.
2. **Run the patterns on a bounded tail** (the last 64 characters). Fast, but a long last word or
   numeral would be read wrongly.
3. **Find the end of the value by walking backwards** over code points, and use regular
   expressions only where they are anchored at the start or cannot backtrack.

## Decision

Option 3. `lettersStart` walks back over letters and combining marks, and `numeralStart` over
digits and separators. Every value is also composed to NFC first, so a backward step never
separates a letter from its mark.

## Consequences

- Analysis is linear in the length of the value. The same script now reports 1.1 ms, 0.4 ms and
  0.1 ms for those inputs (same machine and Node.js version). A unit test inflects
  100,000-character values and asserts a generous bound of 1 s each, which a quadratic scan would
  exceed by orders of magnitude, so the test cannot become flaky on a slow CI machine.
- The scanning code is a few dozen lines longer than the regular expressions it replaces.
- New rules that look at the end of a value must use the same helpers; a reviewer should treat a
  new `$`-anchored pattern over the whole value as a bug.
