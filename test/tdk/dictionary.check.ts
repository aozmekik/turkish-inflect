/**
 * Cross-checks the built-in lexicon and the common nouns of the test corpus against the
 * inflection hint ("taki") that TDK Güncel Türkçe Sözlük prints next to each headword
 * (kitap, -bı; saat, -ti; ağız, -ğzı; hak, -kkı). A headword without a hint is regular.
 *
 * Opt-in and network-bound: `npm run check:tdk`. Responses are cached in the OS temp
 * directory and requests are spaced out to be gentle on the public service.
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
  const words = new Set(Object.keys(DEFAULT_LEXICON.words ?? {}));
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

/** Whether our accusative agrees with one dictionary hint. */
function agrees(word: string, ours: string, taki: string | null): boolean {
  const hints = (taki ?? '')
    .split(',')
    .map((hint) => hint.trim().replace(/^-/u, ''))
    .filter((hint) => hint !== '');
  if (hints.length === 0) return ours.startsWith(word);
  return hints.some((hint) => ours.endsWith(hint) && ours.length - hint.length >= word.length - 3);
}

it('agrees with TDK Güncel Türkçe Sözlük on every checked word', async () => {
  const cache = loadCache();
  const mismatches: string[] = [];
  let checked = 0;
  let missing = 0;
  for (const word of wordsToCheck()) {
    const entries = (await lookup(word, cache)).filter(
      (entry) => entry.madde === word && !(entry.taki ?? '').includes("'"),
    );
    if (entries.length === 0) {
      missing++;
      continue;
    }
    checked++;
    const ours = inflect(word, 'accusative');
    if (!entries.some((entry) => agrees(word, ours, entry.taki))) {
      mismatches.push(
        `${word}: ours ${ours}, TDK ${entries.map((entry) => `-${entry.taki ?? ''}`).join(' / ')}`,
      );
    }
  }
  console.log(
    `TDK check: ${String(checked)} words checked, ${String(missing)} not in the dictionary, ${String(mismatches.length)} mismatches`,
  );
  expect(mismatches).toEqual([]);
});
