/**
 * i18next integration, two ways:
 *  1. custom formatters, so translations use i18next's own `{{name, dative}}` syntax
 *     (recommended: i18next interpolates and inflects in one step);
 *  2. a post-processor that runs `format` on the translated string, so translations can use
 *     `{name:dative}` placeholders next to i18next's `{{...}}` interpolation.
 *
 * The post-processor sees the string after i18next has interpolated `{{...}}` values into it,
 * so braces in those values would be read as placeholders. i18next's `escape` option doubles
 * them first ("{" → "{{"), which `format` turns back into literal braces.
 *
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

/** Fills the placeholders without suffixes: the fallback when a value cannot be inflected. */
function withoutSuffixes(template: string, values: TemplateValues): string {
  const plain = template.replace(/\{\{|\}\}|\{([^{}:]+):[^{}]*\}/gu, (match, name?: string) =>
    name === undefined ? match : `{${name}}`,
  );
  try {
    return format(plain, values);
  } catch (error) {
    if (error instanceof InflectError) return template;
    throw error;
  }
}

const turkishInflect: PostProcessorModule = {
  type: 'postProcessor',
  name: 'turkishInflect',
  process(value, _key, options) {
    const values = templateValues(options);
    try {
      return format(value, values);
    } catch (error) {
      // Never break the UI because of a value we cannot read; show it uninflected instead.
      if (error instanceof InflectError) return withoutSuffixes(value, values);
      throw error;
    }
  },
};

await i18next.use(turkishInflect).init({
  lng: 'tr',
  postProcess: ['turkishInflect'],
  interpolation: {
    // Only braces are escaped, for the post-processor; HTML escaping is left to the UI layer
    // (React escapes). Formatter output contains apostrophes, which must not be escaped.
    escapeValue: true,
    escape: (text) => text.replace(/[{}]/gu, (brace) => brace + brace),
  },
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

// Formatter syntax: register one formatter per suffix name, with the same fallback.
for (const suffix of SUFFIXES) {
  i18next.services.formatter?.add(suffix, (value: string | number) => {
    try {
      return inflect(value, suffix);
    } catch (error) {
      if (error instanceof InflectError) return String(value);
      throw error;
    }
  });
}

const t = i18next.t.bind(i18next);
assert.equal(t('welcome', { name: 'Ahmet' }), "Ahmet'e hoş geldin dedik");
assert.equal(t('welcome', { name: 'C++' }), 'C++ hoş geldin dedik');
assert.equal(t('sent', { name: 'Ayşe' }), "Ayşe'ye bir mesaj gönderildi");
assert.equal(t('sent', { name: 'TBMM' }), "TBMM'ye bir mesaj gönderildi");
assert.equal(t('office', { city: 'İzmir', count: 12 }), "İzmir'deki ofisimiz 12 kişi");
assert.equal(t('sent', { name: 'C++' }), 'C++ bir mesaj gönderildi');
// User data with braces stays data: it is neither expanded nor able to switch inflection off.
assert.equal(
  t('office', { city: 'İzmir', count: '{city:ablative}' }),
  "İzmir'deki ofisimiz {city:ablative} kişi",
);
assert.equal(t('office', { city: 'İzmir', count: 'a}b' }), "İzmir'deki ofisimiz a}b kişi");
assert.equal(t('office', { city: 'C++', count: '{x}' }), 'C++ ofisimiz {x} kişi');
console.log(t('sent', { name: 'İstanbul' }));

console.log('i18next: ok');
