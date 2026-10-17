/**
 * i18next integration, two ways:
 *  1. a post-processor that runs `format` on the translated string, so translations can use
 *     `{name:dative}` placeholders next to i18next's own `{{...}}` interpolation;
 *  2. custom formatters, so translations can use i18next's `{{name, dative}}` syntax.
 * Run with `npm run build && node examples/i18next.ts`.
 */
import assert from 'node:assert/strict';

import i18next, { type PostProcessorModule } from 'i18next';
import { InflectError, SUFFIXES, type TemplateValues, format, inflect } from 'turkish-inflect';

/** Keeps only the option values `format` can use. */
function templateValues(options: Record<string, unknown>): TemplateValues {
  const values: Record<string, string | number | bigint> = {};
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint')
      values[key] = value;
  }
  return values;
}

const turkishInflect: PostProcessorModule = {
  type: 'postProcessor',
  name: 'turkishInflect',
  process(value, _key, options) {
    try {
      return format(value, templateValues(options));
    } catch (error) {
      // Never break the UI because of a value we cannot read; show it unchanged instead.
      if (error instanceof InflectError) {
        return value.replace(/\{(\w+)(?::[^}]*)?\}/gu, (_, name: string) => {
          const raw = options[name];
          return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
        });
      }
      throw error;
    }
  },
};

await i18next.use(turkishInflect).init({
  lng: 'tr',
  postProcess: ['turkishInflect'],
  // Formatter output contains apostrophes; escaping is left to the UI layer (React escapes).
  interpolation: { escapeValue: false },
  resources: {
    tr: {
      translation: {
        sent: '{name:dative} bir mesaj gönderildi',
        office: '{city:locative+ki} ofisimiz {{count}} kişi',
        welcome: '{{name, dative}} hoş geldin dedik',
      },
    },
  },
});

// Formatter syntax: register one formatter per suffix name.
for (const suffix of SUFFIXES) {
  i18next.services.formatter?.add(suffix, (value: string | number) => inflect(value, suffix));
}

const t = i18next.t.bind(i18next);
assert.equal(t('sent', { name: 'Ayşe' }), "Ayşe'ye bir mesaj gönderildi");
assert.equal(t('sent', { name: 'TBMM' }), "TBMM'ye bir mesaj gönderildi");
assert.equal(t('office', { city: 'İzmir', count: 12 }), "İzmir'deki ofisimiz 12 kişi");
assert.equal(t('welcome', { name: 'Ahmet' }), "Ahmet'e hoş geldin dedik");
assert.equal(t('sent', { name: 'C++' }), 'C++ bir mesaj gönderildi');
console.log(t('sent', { name: 'İstanbul' }));

console.log('i18next: ok');
