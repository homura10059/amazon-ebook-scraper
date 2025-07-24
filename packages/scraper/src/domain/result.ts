/**
 * Result type for railway-oriented programming
 * Based on Scott Wlaschin's "Domain Modeling Made Functional"
 */

export type Result<T, E> = Success<T> | Failure<E>;

export interface Success<T> {
  readonly success: true;
  readonly data: T;
}

export interface Failure<E> {
  readonly success: false;
  readonly error: E;
}

/**
 * Create a successful Result
 */
export const ok = <T>(data: T): Success<T> => ({
  success: true,
  data,
});

/**
 * Create a failed Result
 */
export const err = <E>(error: E): Failure<E> => ({
  success: false,
  error,
});

/**
 * Map over the data of a successful Result
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> => (result.success ? ok(fn(result.data)) : result);

/**
 * FlatMap (bind) operation for chaining Results
 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> => (result.success ? fn(result.data) : result);

/**
 * Map over the error of a failed Result
 */
export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => (result.success ? result : err(fn(result.error)));

/**
 * Unwrap Result data or throw error
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.success) {
    return result.data;
  }
  throw new Error(`Result unwrap failed: ${String(result.error)}`);
};

/**
 * Unwrap Result data or return default value
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.success ? result.data : defaultValue;

/**
 * Check if Result is successful
 */
export const isOk = <T, E>(result: Result<T, E>): result is Success<T> =>
  result.success;

/**
 * Check if Result is failed
 */
export const isErr = <T, E>(result: Result<T, E>): result is Failure<E> =>
  !result.success;

/**
 * Convert a function that might throw into a Result
 */
export const tryCatch = <T, E = Error>(
  fn: () => T,
  errorHandler?: (error: unknown) => E
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (error) {
    const mappedError = errorHandler ? errorHandler(error) : (error as E);
    return err(mappedError);
  }
};

/**
 * Convert an async function that might throw into a Result
 */
export const tryCatchAsync = async <T, E = Error>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    const mappedError = errorHandler ? errorHandler(error) : (error as E);
    return err(mappedError);
  }
};

/**
 * Functional pipe utility for chaining operations
 */
export const pipe = <T>(value: T) => ({
  map: <U>(fn: (value: T) => U) => pipe(fn(value)),
  flatMap: <U, E>(fn: (value: T) => Result<U, E>) => fn(value),
  unwrap: () => value,
});
