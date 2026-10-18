# Contributing

Thanks for helping. Bug reports with a wrong inflection are the most useful contribution: please
include the value, the suffix, what the library returned, what you expected, and a source (the
TDK spelling guide or dictionary) if you have one.

## Setup

Requirements: Node.js 22.18 or newer (the scripts and examples are TypeScript files run by Node
directly) and npm.

```sh
git clone https://github.com/aozmekik/turkish-inflect.git
cd turkish-inflect
npm ci          # also builds dist/ through the prepare script
```

## Commands

| Command                                   | What it does                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run format` / `npm run format:check` | Prettier                                                                                                       |
| `npm run lint`                            | ESLint (typescript-eslint strict, type-checked), zero warnings allowed                                         |
| `npm run typecheck`                       | `tsc` over sources, tests, examples and scripts                                                                |
| `npm test`                                | Vitest: corpus, unit, property and documentation-example tests                                                 |
| `npm run coverage`                        | Tests with V8 coverage and thresholds                                                                          |
| `npm run build`                           | ESM + CJS bundles and declarations with tsup                                                                   |
| `npm run check:package`                   | publint and are-the-types-wrong on the packed tarball                                                          |
| `npm run examples`                        | Runs every file in `examples/` against `dist/` (build first)                                                   |
| `npm run size`                            | Size of the build, raw, gzip and brotli (build first)                                                          |
| `npm run bench`                           | tinybench micro-benchmarks of `dist/` (build first)                                                            |
| `node bench/long-input.ts`                | Times long values that do not end in a readable word (build first)                                             |
| `npm run check:tdk`                       | Opt-in, needs network: compares the lexicon, the corpus and a held-out word list with TDK Güncel Türkçe Sözlük |
| `npm run check`                           | Everything CI runs, in order                                                                                   |

## Changing behaviour

1. Add the expected forms to the right section of `test/corpus/` with the source of the rule,
   and watch them fail.
2. Fix the code or the lexicon (`src/lexicon.ts`). A new lexicon word needs a source: an example
   from the TDK spelling guide, or the inflection hint of its TDK dictionary entry.
3. Run `npm run check`. If you touched the lexicon, also run `npm run check:tdk`; it fetches
   each word once from sozluk.gov.tr (spaced out, cached in the OS temp directory). Lexicon words
   and corpus nouns must all agree with the dictionary; the held-out list in
   `test/tdk/held-out.ts` is only reported. Do not tune the lexicon to a fresh held-out list
   before recording its first result, or the figure stops meaning anything.
4. Code that looks at the end of a value must scan it in linear time (see
   [ADR 0005](docs/adr/0005-linear-time-scanning-of-values.md)); do not add `$`-anchored regular
   expressions that run over a whole value.
5. If you change documented behaviour, update the `expression; // "result"` examples in
   README.md and the doc comments; `test/docs.test.ts` evaluates them.

Coverage thresholds are 100% for lines, statements and functions; branches are held at 97%
because `noUncheckedIndexedAccess` requires `??` fallbacks on a few array lookups that cannot
miss.

## Toolchain notes

TypeScript is pinned to 6.0.x because typescript-eslint supports TypeScript below 6.1; the
native TypeScript 7 compiler can be adopted once typescript-eslint supports it.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
`test:`, `refactor:`, `chore:`, `ci:`), keep each commit focused, and make each commit pass
`npm run check` with its tests included.
