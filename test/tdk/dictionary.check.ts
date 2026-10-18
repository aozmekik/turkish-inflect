/**
 * Cross-checks the library against the inflection hint ("taki") that TDK Güncel Türkçe Sözlük
 * prints next to each headword (kitap, -bı; saat, -ti; ağız, -ğzı; hak, -kkı). A headword without
 * a hint is regular: no stem change, and harmony with its last vowel.
 *
 * 1. Every lexicon word and every common noun of the corpus must agree with the dictionary.
 * 2. A held-out list of everyday and UI nouns (./held-out.ts) is reported as an accuracy figure.
 *
 * Opt-in and network-bound: `npm run check:tdk`. Responses are cached in the OS temp directory
 * and requests are spaced out to be gentle on the public service.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { expect, it } from 'vitest';

import { DEFAULT_LEXICON, inflect } from '../../src/index.js';
import { consonants } from '../corpus/consonants.js';
import { harmony } from '../corpus/harmony.js';
import { lexical } from '../corpus/lexical.js';
import type { Section } from '../corpus/types.js';
import { HELD_OUT } from './held-out.js';

interface Headword {
  readonly madde: string;
  readonly taki: string | null;
}

const ENDPOINT = 'https://sozluk.gov.tr/gts?ara=';
const CACHE_DIR = join(tmpdir(), 'turkish-inflect-tdk-cache');
const CACHE_FILE = join(CACHE_DIR, 'gts.json');
const DELAY_MS = 800;

function loadCache(): Record<string, Headword[]> {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, Headword[]>;
  } catch {
    return {};
  }
}

async function lookup(word: string, cache: Record<string, Headword[]>): Promise<Headword[]> {
  const cached = cache[word];
  if (cached !== undefined) return cached;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(DELAY_MS * (attempt + 1));
    try {
      const response = await fetch(ENDPOINT + encodeURIComponent(word));
      const body = (await response.text()).trim();
      if (body === '') continue;
      const parsed = JSON.parse(body) as unknown;
      const entries = Array.isArray(parsed)
        ? (parsed as Headword[]).map(({ madde, taki }) => ({ madde, taki }))
        : [];
      cache[word] = entries;
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return entries;
    } catch {
      // Retry: the service occasionally answers with an empty or truncated body.
    }
  }
  throw new Error(`No answer from TDK for "${word}"`);
}

/** Words to check: lexicon keys plus single lower-case words used in the corpus. */
function wordsToCheck(): string[] {
  const words = new Set(Object.keys(DEFAULT_LEXICON.words));
  const sections: readonly Section[] = [...harmony, ...consonants, ...lexical];
  for (const section of sections) {
    for (const [input, , , options] of section.cases) {
      if (typeof input === 'string' && /^[a-zçğıöşüâîû]+$/u.test(input) && options === undefined) {
        words.add(input);
      }
    }
  }
  return [...words].sort((a, b) => a.localeCompare(b, 'tr'));
}

const PLAIN_VOWEL: Readonly<Record<string, string>> = {
  a: 'a',
  â: 'a',
  e: 'e',
  ı: 'ı',
  i: 'i',
  î: 'i',
  o: 'o',
  ö: 'ö',
  u: 'u',
  û: 'u',
  ü: 'ü',
};

/**
 * The accusative of a regular word, computed independently of the library: no stem change,
 * four-way harmony with the last vowel, and a buffer y after a final vowel.
 */
function regularAccusative(word: string): string {
  const letters = Array.from(word);
  const vowels = letters.map((ch) => PLAIN_VOWEL[ch]).filter((v) => v !== undefined);
  const last = vowels.at(-1) ?? 'e';
  const suffix = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[last] ?? 'i';
  const endsInVowel = PLAIN_VOWEL[letters.at(-1) ?? ''] !== undefined;
  return word + (endsInVowel ? 'y' : '') + suffix;
}

/** Whether our accusative agrees with one dictionary entry. */
function agrees(word: string, ours: string, taki: string | null): boolean {
  const hints = (taki ?? '')
    .split(',')
    .map((hint) => hint.trim().replace(/^-/u, ''))
    .filter((hint) => hint !== '');
  if (hints.length === 0) return ours === regularAccusative(word);
  return hints.some((hint) => ours.endsWith(hint) && ours.length - hint.length >= word.length - 3);
}

interface Report {
  readonly checked: number;
  readonly missing: readonly string[];
  readonly mismatches: readonly string[];
}

async function compare(words: readonly string[]): Promise<Report> {
  const cache = loadCache();
  const missing: string[] = [];
  const mismatches: string[] = [];
  let checked = 0;
  for (const word of words) {
    const entries = (await lookup(word, cache)).filter(
      (entry) => entry.madde === word && !(entry.taki ?? '').includes("'"),
    );
    if (entries.length === 0) {
      missing.push(word);
      continue;
    }
    checked++;
    const ours = inflect(word, 'accusative');
    if (!entries.some((entry) => agrees(word, ours, entry.taki))) {
      const tdk = entries.map((entry) => ((entry.taki ?? '') === '' ? 'no hint' : `-${entry.taki ?? ''}`));
      mismatches.push(`${word}: ours ${ours}, TDK ${tdk.join(' / ')}`);
    }
  }
  return { checked, missing, mismatches };
}

it('agrees with TDK Güncel Türkçe Sözlük on every lexicon word and corpus noun', async () => {
  const { checked, missing, mismatches } = await compare(wordsToCheck());
  console.log(
    `TDK check: ${String(checked)} words checked, ${String(missing.length)} not in the dictionary, ${String(mismatches.length)} mismatches`,
  );
  expect(mismatches).toEqual([]);
});

it('reports the agreement on the held-out list', async () => {
  const words = [...new Set(HELD_OUT)];
  const lexiconWords = new Set(Object.keys(DEFAULT_LEXICON.words));
  const { checked, missing, mismatches } = await compare(words);
  const listed = words.filter((word) => lexiconWords.has(word)).length;
  console.log(
    `Held-out list: ${String(words.length)} words, ${String(missing.length)} not in the dictionary` +
      ` (${missing.join(', ')}), ${String(checked)} checked, ${String(checked - mismatches.length)} agree` +
      ` (${((100 * (checked - mismatches.length)) / checked).toFixed(1)}%); ${String(listed)} are lexicon entries.`,
  );
  if (mismatches.length > 0) console.log(`Mismatches:\n  ${mismatches.join('\n  ')}`);
  expect(checked).toBeGreaterThan(0);
});
