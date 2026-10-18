/**
 * Assembles analysis, suffix rendering and templates into an {@link Inflector}.
 *
 * @module
 */

import {
  type Analysis,
  type InflectOptions,
  type InflectValue,
  type InternalAnalysis,
  analyzeValue,
  textOf,
} from './analysis.js';
import { InflectError } from './errors.js';
import { type Lexicon, compileLexicon } from './lexicon.js';
import { startsWithVowel, vowelStem } from './phonology.js';
import { type CanonicalSuffix, type SuffixInput, normalizeChain, renderChain, specOf } from './suffixes.js';
import { type TemplateValue, type TemplateValues, createFormat, createTag } from './template.js';
import { checkInflectable, checkObject, checkOptions } from './validate.js';

/** Options that can be set once for every call of an {@link Inflector}. */
export type InflectDefaults = Pick<InflectOptions, 'kind' | 'abbreviation' | 'apostrophe'>;

/** Configuration for {@link createInflector}. */
export interface InflectorConfig {
  /** Words and pronunciations added to (or overriding) the built-in lexicon. */
  readonly lexicon?: Lexicon;
  /** Options applied to every call unless the call overrides them. */
  readonly defaults?: InflectDefaults;
}

/** A set of inflection functions sharing one lexicon and one set of defaults. */
export interface Inflector {
  /** See the top-level {@link inflect}. */
  readonly inflect: (value: InflectValue, suffixes: SuffixInput, options?: InflectOptions) => string;
  /** See the top-level {@link analyze}. */
  readonly analyze: (value: InflectValue, options?: InflectOptions) => Analysis;
  /** See the top-level {@link format}. */
  readonly format: (template: string, values: TemplateValues, options?: InflectOptions) => string;
  /** See the top-level {@link tr}. */
  readonly tr: (strings: TemplateStringsArray, ...values: readonly TemplateValue[]) => string;
}

const NARROW_VOWEL_END = /[ıiuü]$/u;

function checkSupported(
  chain: readonly CanonicalSuffix[],
  analysis: InternalAnalysis,
  options: InflectOptions,
): void {
  if (chain.includes('ordinal') && !(analysis.kind === 'number' && analysis.integer)) {
    throw new InflectError(
      'UNSUPPORTED',
      `The ordinal suffix needs an integer written in digits (15'inci); "${analysis.text}" is not one. Use ordinal() for words.`,
    );
  }
  if (chain[0] === 'ki' && analysis.apostrophe) {
    throw new InflectError(
      'UNSUPPORTED',
      `"ki" directly after "${analysis.text}" is not supported; use ["locative", "ki"] (İstanbul'daki) or ["genitive", "ki"] (Ahmet'inki).`,
    );
  }
  if (options.compound === true) {
    const slots = chain.map((suffix) => specOf(suffix).slot);
    if (slots.includes('plural') || slots.includes('possessive')) {
      throw new InflectError(
        'UNSUPPORTED',
        'Plural and possessive suffixes replace the possessive of a compound noun and are not supported with `compound: true`.',
      );
    }
    if (!NARROW_VOWEL_END.test(analysis.finalWord)) {
      throw new InflectError(
        'UNSUPPORTED',
        `\`compound: true\` expects a value ending in the 3rd-person possessive (-ı, -i, -u, -ü), got "${analysis.text}".`,
      );
    }
  }
}

function inflectAnalyzed(
  analysis: InternalAnalysis,
  chain: readonly CanonicalSuffix[],
  options: InflectOptions,
): string {
  checkSupported(chain, analysis, options);
  const { stem, entry } = analysis;
  // su → suyu, suyun: only written stems (common nouns) carry this irregularity.
  const sound =
    stem !== undefined && entry?.bufferY === true ? { ...analysis.sound, bufferY: true } : analysis.sound;
  const parts = renderChain(chain, sound, {
    pronominal: options.compound === true,
    finalWord: analysis.finalWord,
  });

  let written = analysis.text;
  const first = parts[0];
  if (stem !== undefined && first !== undefined && !first.separate && startsWithVowel(first.text)) {
    written = written.slice(0, stem.start) + vowelStem(written.slice(stem.start), entry, stem.syllables);
  }

  const apostrophe = options.apostrophe ?? "'";
  let attached = false;
  for (const part of parts) {
    if (!part.separate && !attached) {
      attached = true;
      // TDK: the plural (and what follows it) takes no apostrophe on proper nouns: Ahmetler.
      if (analysis.apostrophe && !(analysis.kind === 'proper' && part.suffix === 'plural')) {
        written += apostrophe;
      }
    }
    written += part.text;
  }
  return written;
}

/**
 * Creates an independent set of inflection functions with its own lexicon additions and
 * defaults. The top-level functions use an inflector created with no configuration.
 *
 * @example
 * ```ts
 * const { inflect, format } = createInflector({
 *   lexicon: { readings: { iPhone: 'ayfon', Shakespeare: 'şekspir' } },
 *   defaults: { apostrophe: '’' },
 * });
 * inflect('iPhone', 'dative'); // "iPhone’a"
 * format('{author:genitive} oyunları', { author: 'Shakespeare' }); // "Shakespeare’in oyunları"
 * ```
 */
export function createInflector(config: InflectorConfig = {}): Inflector {
  checkObject(config, 'the inflector configuration');
  const lexicon = compileLexicon(config.lexicon);
  const defaults: InflectOptions = config.defaults ?? {};
  checkOptions(defaults);

  const inflect = (value: InflectValue, suffixes: SuffixInput, options: InflectOptions = {}): string => {
    checkInflectable(value);
    checkOptions(options);
    const chain = normalizeChain(suffixes);
    // A value with no suffix is written as it is, even when it cannot be read aloud (C++, 🙂).
    if (chain.length === 0) return textOf(value);
    const merged = { ...defaults, ...options };
    return inflectAnalyzed(analyzeValue(value, merged, lexicon), chain, merged);
  };

  const analyze = (value: InflectValue, options: InflectOptions = {}): Analysis => {
    checkInflectable(value);
    checkOptions(options);
    const { text, kind, reading, apostrophe } = analyzeValue(value, { ...defaults, ...options }, lexicon);
    return { text, kind, reading, apostrophe };
  };

  return { inflect, analyze, format: createFormat(inflect), tr: createTag(inflect, defaults) };
}
