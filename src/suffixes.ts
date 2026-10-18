/**
 * The suffix catalogue, the order in which suffixes may be combined, and chain rendering.
 *
 * @module
 */

import { InflectError } from './errors.js';
import { type Sound, type Template, render, template } from './phonology.js';
import { describe } from './validate.js';

const SUFFIX_NAMES = [
  'plural',
  'accusative',
  'dative',
  'locative',
  'ablative',
  'genitive',
  'instrumental',
  'ile',
  'possessive',
  'possessive1sg',
  'possessive2sg',
  'possessive3sg',
  'possessive1pl',
  'possessive2pl',
  'possessive3pl',
  'ki',
  'ordinal',
  'copula',
  'question',
] as const;

/** Every suffix name accepted by `inflect`, `format` and friends (a frozen array). */
export const SUFFIXES: typeof SUFFIX_NAMES = /* @__PURE__ */ Object.freeze(SUFFIX_NAMES);

/**
 * A suffix name.
 *
 * | Name            | Suffix                | Example                         |
 * | --------------- | --------------------- | ------------------------------- |
 * | `plural`        | -lar / -ler           | kitaplar, Ahmetler              |
 * | `accusative`    | -(y)ı                 | kitabı, Ayşe'yi                 |
 * | `dative`        | -(y)a                 | kitaba, Ayşe'ye                 |
 * | `locative`      | -da / -ta             | kitapta, İstanbul'da            |
 * | `ablative`      | -dan / -tan           | kitaptan, Ankara'dan            |
 * | `genitive`      | -(n)ın                | kitabın, Ayşe'nin               |
 * | `instrumental`  | -(y)la                | kitapla, Ayşe'yle               |
 * | `ile`           | the separate word ile | Ayşe ile                        |
 * | `possessive`    | -(s)ı (3rd sg)        | kitabı, Ayşe'si                 |
 * | `possessive1sg` … `possessive3pl` | -(ı)m, -(ı)n, -(s)ı, -(ı)mız, -(ı)nız, -ları | kitabım, kitabınız |
 * | `ki`            | -ki (-kü)             | evdeki, yarınki, bugünkü        |
 * | `ordinal`       | -(ı)ncı (numbers)     | 15'inci, 2'nci                  |
 * | `copula`        | -dır / -tır           | kitaptır, Ankara'dır            |
 * | `question`      | the separate word mı  | Ayşe mi, kitap mı (mıdır)       |
 */
export type Suffix = (typeof SUFFIXES)[number];

/** One suffix or an ordered chain of suffixes. */
export type SuffixInput = Suffix | readonly Suffix[];

/** A suffix name with aliases resolved. */
export type CanonicalSuffix = Exclude<Suffix, 'possessive'>;

type Slot = 'ordinal' | 'plural' | 'possessive' | 'case' | 'ki' | 'copula' | 'question';

interface SuffixSpec {
  readonly slot: Slot;
  readonly template: Template;
  /** The form used after a 3rd-person possessive or -ki (pronominal n: kitabına, evdekini). */
  readonly pronominal?: Template;
  /** Written as a separate word, never with an apostrophe. */
  readonly separate?: boolean;
  /** Makes the next case suffix take the pronominal n. */
  readonly setsPronominal?: boolean;
}

const SPECS: Readonly<Record<CanonicalSuffix, SuffixSpec>> = {
  ordinal: { slot: 'ordinal', template: /* @__PURE__ */ template('(I)ncI') },
  plural: { slot: 'plural', template: /* @__PURE__ */ template('lAr') },
  possessive1sg: { slot: 'possessive', template: /* @__PURE__ */ template('(I)m') },
  possessive2sg: { slot: 'possessive', template: /* @__PURE__ */ template('(I)n') },
  possessive3sg: { slot: 'possessive', template: /* @__PURE__ */ template('(s)I'), setsPronominal: true },
  possessive1pl: { slot: 'possessive', template: /* @__PURE__ */ template('(I)mIz') },
  possessive2pl: { slot: 'possessive', template: /* @__PURE__ */ template('(I)nIz') },
  possessive3pl: { slot: 'possessive', template: /* @__PURE__ */ template('lArI'), setsPronominal: true },
  accusative: {
    slot: 'case',
    template: /* @__PURE__ */ template('(y)I'),
    pronominal: /* @__PURE__ */ template('nI'),
  },
  dative: {
    slot: 'case',
    template: /* @__PURE__ */ template('(y)A'),
    pronominal: /* @__PURE__ */ template('nA'),
  },
  locative: {
    slot: 'case',
    template: /* @__PURE__ */ template('DA'),
    pronominal: /* @__PURE__ */ template('nDA'),
  },
  ablative: {
    slot: 'case',
    template: /* @__PURE__ */ template('DAn'),
    pronominal: /* @__PURE__ */ template('nDAn'),
  },
  genitive: { slot: 'case', template: /* @__PURE__ */ template('(n)In') },
  instrumental: { slot: 'case', template: /* @__PURE__ */ template('(y)lA') },
  ile: { slot: 'case', template: /* @__PURE__ */ template(' ile'), separate: true },
  ki: { slot: 'ki', template: /* @__PURE__ */ template('ki'), setsPronominal: true },
  question: { slot: 'question', template: /* @__PURE__ */ template(' mI'), separate: true },
  // After the question particle the copula attaches to it: kitap mıdır, not kitaptır mı.
  copula: { slot: 'copula', template: /* @__PURE__ */ template('DIr') },
};

/** After the plural, the 3rd-person plural possessive is just -ı (kitaplar + ları → kitapları). */
const POSSESSIVE_3PL_AFTER_PLURAL = /* @__PURE__ */ template('I');
/** -ki follows vowel harmony only in bugünkü, dünkü, öbürkü (TDK Yazım Kılavuzu). */
const KI_ROUNDED = /* @__PURE__ */ template('kü');
const KI_ROUNDED_WORDS: ReadonlySet<string> = /* @__PURE__ */ new Set(['bugün', 'dün', 'öbür']);

/** Position of each slot in a word; plural and case may appear again after -ki. */
const ORDER: Readonly<Record<Slot, number>> = {
  ordinal: 0,
  plural: 1,
  possessive: 2,
  case: 3,
  ki: 4,
  question: 7,
  copula: 8,
};

const KNOWN: ReadonlySet<string> = /* @__PURE__ */ new Set(SUFFIXES);

const ORDER_HINT =
  'Suffixes combine in the order ordinal, plural, possessive, case, ki (after locative or genitive), plural, case, question, copula.';

/** Returns the specification of a canonical suffix. */
export function specOf(suffix: CanonicalSuffix): SuffixSpec {
  return SPECS[suffix];
}

/** Accepts a suffix name or an array of them; anything else is an `INVALID_ARGUMENT`. */
function suffixList(input: unknown): readonly string[] {
  if (typeof input === 'string') return [input];
  if (Array.isArray(input) && input.every((name) => typeof name === 'string')) return input;
  throw new InflectError(
    'INVALID_ARGUMENT',
    `Expected a suffix name or an array of suffix names, got ${describe(input)}${Array.isArray(input) ? ' with non-string items' : ''}.`,
  );
}

/**
 * Resolves aliases and checks that the suffixes can follow each other:
 * ordinal → plural → possessive → case → ki → plural → case → question → copula.
 *
 * @throws {@link InflectError} `INVALID_SUFFIX`, `INVALID_SUFFIX_ORDER` or `INVALID_ARGUMENT`.
 */
export function normalizeChain(input: SuffixInput): CanonicalSuffix[] {
  const list = suffixList(input);
  const chain: CanonicalSuffix[] = [];
  let position = -1;
  let afterKi = false;
  let previous: CanonicalSuffix | 'start' = 'start';
  for (const name of list) {
    if (!KNOWN.has(name)) {
      throw new InflectError(
        'INVALID_SUFFIX',
        `Unknown suffix "${name}". Expected one of: ${SUFFIXES.join(', ')}.`,
      );
    }
    const suffix = (name === 'possessive' ? 'possessive3sg' : name) as CanonicalSuffix;
    const { slot } = SPECS[suffix];
    let index = ORDER[slot];
    if (afterKi && slot === 'plural') index = 5;
    if (afterKi && slot === 'case') index = 6;
    const kiMisplaced =
      slot === 'ki' && previous !== 'start' && previous !== 'locative' && previous !== 'genitive';
    if (index <= position || kiMisplaced || (previous === 'ile' && slot !== 'question')) {
      const hint =
        previous === 'copula' && slot === 'question'
          ? 'The question particle carries the copula: use ["question", "copula"] (kitap mıdır).'
          : ORDER_HINT;
      throw new InflectError(
        'INVALID_SUFFIX_ORDER',
        `"${name}" cannot follow "${previous}" in [${list.join(', ')}]. ${hint}`,
      );
    }
    if (slot === 'ki') afterKi = true;
    position = index;
    previous = suffix;
    chain.push(suffix);
  }
  return chain;
}

/** One rendered suffix of a chain. */
export interface RenderedSuffix {
  readonly suffix: CanonicalSuffix;
  readonly text: string;
  readonly separate: boolean;
}

/** Context needed to render a chain after a particular word. */
export interface ChainContext {
  /** The value already ends in a 3rd-person possessive (Türk Dil Kurumu → Kurumuna). */
  readonly pronominal: boolean;
  /** The phonological form of the final word, to recognise bugün / dün / öbür before -ki. */
  readonly finalWord: string;
}

/** Renders every suffix of a validated chain, threading the phonological state through. */
export function renderChain(
  chain: readonly CanonicalSuffix[],
  start: Sound,
  context: ChainContext,
): RenderedSuffix[] {
  const parts: RenderedSuffix[] = [];
  let sound = start;
  let pronominal = context.pronominal;
  let plural = false;
  for (const [index, suffix] of chain.entries()) {
    const spec = SPECS[suffix];
    let segments = pronominal && spec.pronominal !== undefined ? spec.pronominal : spec.template;
    if (suffix === 'possessive3pl' && plural) segments = POSSESSIVE_3PL_AFTER_PLURAL;
    if (suffix === 'ki' && index === 0 && KI_ROUNDED_WORDS.has(context.finalWord)) segments = KI_ROUNDED;
    const rendered = render(segments, sound);
    parts.push({ suffix, text: rendered.text, separate: spec.separate === true });
    sound = rendered.sound;
    pronominal = spec.setsPronominal === true;
    if (suffix === 'plural') plural = true;
  }
  return parts;
}
