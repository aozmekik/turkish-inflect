/**
 * Argument checks at the public boundary, so that calls from plain JavaScript fail with an
 * {@link InflectError} instead of a `TypeError` from deep inside the library or, worse, a
 * silently wrong answer (an unknown `kind` would otherwise read as a common noun).
 *
 * @module
 * @internal
 */

import { InflectError } from './errors.js';

/** A short description of a value's type for error messages: "null", "an array", "a number". */
export function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  const type = typeof value;
  return type === 'undefined' ? 'undefined' : `${/^[aeiou]/u.test(type) ? 'an' : 'a'} ${type}`;
}

function invalid(message: string): never {
  throw new InflectError('INVALID_ARGUMENT', message);
}

/** Throws unless `value` is a string. */
export function checkString(value: unknown, what: string): asserts value is string {
  if (typeof value !== 'string') invalid(`Expected ${what} to be a string, got ${describe(value)}.`);
}

/** Throws unless `value` can be inflected: a string, a number or a bigint. */
export function checkInflectable(value: unknown): asserts value is string | number | bigint {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    invalid(`Expected a string, number or bigint to inflect, got ${describe(value)}.`);
  }
}

/** Throws unless `value` is an object (not null, not an array); returns it for reading its fields. */
export function checkObject(value: unknown, what: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`Expected ${what} to be an object, got ${describe(value)}.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

const ENUMS: Readonly<Record<string, readonly string[]>> = {
  kind: ['auto', 'proper', 'common'],
  abbreviation: ['auto', 'letters', 'word'],
  decimal: ['virgül', 'tam'],
};

const TYPES: Readonly<Record<string, string>> = {
  reading: 'string',
  apostrophe: 'string',
  compound: 'boolean',
};

/**
 * Throws unless `options` is an object whose known options have valid values. Unknown keys are
 * ignored, so option bags shared with other libraries are accepted.
 */
export function checkOptions(options: unknown): void {
  const fields = checkObject(options, 'the options');
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = fields[key];
    if (value !== undefined && !allowed.includes(value as string)) {
      const shown = typeof value === 'string' ? JSON.stringify(value) : describe(value);
      invalid(`Invalid option ${key}: ${shown}. Expected one of: ${allowed.join(', ')}.`);
    }
  }
  for (const [key, type] of Object.entries(TYPES)) {
    const value = fields[key];
    if (value !== undefined && typeof value !== type) {
      invalid(`Invalid option ${key}: expected a ${type}, got ${describe(value)}.`);
    }
  }
}
