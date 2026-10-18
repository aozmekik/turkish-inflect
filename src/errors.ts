/**
 * Machine-readable reason attached to every {@link InflectError}.
 *
 * - `EMPTY_VALUE`: the value is empty or only whitespace.
 * - `UNREADABLE`: the library cannot tell how the value is pronounced (pass `reading`).
 * - `INVALID_NUMBER`: a numeric input is not a finite number in Turkish notation.
 * - `OUT_OF_RANGE`: a number is too large to be read (the largest scale word is "kentilyon").
 * - `INVALID_SUFFIX`: an unknown suffix name was requested.
 * - `INVALID_SUFFIX_ORDER`: the suffixes cannot be combined in the requested order.
 * - `UNSUPPORTED`: the combination is grammatical but deliberately not supported.
 * - `TEMPLATE_SYNTAX`: a template passed to `format` or `tr` is malformed.
 * - `MISSING_VALUE`: a template placeholder has no value, or its value is `null` or `undefined`.
 * - `INVALID_ARGUMENT`: an argument has the wrong type or an option an unknown value (a call
 *   from JavaScript that the TypeScript types would have rejected).
 */
export type InflectErrorCode =
  | 'EMPTY_VALUE'
  | 'UNREADABLE'
  | 'INVALID_NUMBER'
  | 'OUT_OF_RANGE'
  | 'INVALID_SUFFIX'
  | 'INVALID_SUFFIX_ORDER'
  | 'UNSUPPORTED'
  | 'TEMPLATE_SYNTAX'
  | 'MISSING_VALUE'
  | 'INVALID_ARGUMENT';

/**
 * The only error the library throws: a value or template cannot be inflected correctly, or an
 * argument is invalid.
 *
 * The library never guesses silently when it knows its answer would be wrong; it throws
 * this error instead so that the caller can decide on a fallback.
 *
 * @example
 * ```ts
 * try {
 *   inflect('C++', 'dative');
 * } catch (error) {
 *   if (error instanceof InflectError && error.code === 'UNREADABLE') {
 *     inflect('C++', 'dative', { reading: 'si plas plas' }); // "C++'a"
 *   }
 * }
 * ```
 */
export class InflectError extends Error {
  /** Machine-readable reason for the failure. */
  readonly code: InflectErrorCode;

  /**
   * @param code - Machine-readable reason.
   * @param message - Human-readable explanation, in English.
   */
  constructor(code: InflectErrorCode, message: string) {
    super(message);
    this.name = 'InflectError';
    this.code = code;
  }
}
