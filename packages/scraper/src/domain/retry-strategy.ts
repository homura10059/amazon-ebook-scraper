type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export interface RetryOptions {
  readonly maxRetries: number;
}

export interface RetryError extends Error {
  readonly attemptCount: number;
  readonly lastError: Error;
}

const createExponentialDelay = (attempt: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));

const createRetryError = (
  attemptCount: number,
  lastError: Error
): RetryError => {
  const retryError = new Error(
    `Operation failed after ${attemptCount} attempts: ${lastError.message}`
  );
  return Object.assign(retryError, { attemptCount, lastError }) as RetryError;
};

export const executeWithRetry = async <T>(
  operation: () => Promise<Result<T, Error>>,
  options: RetryOptions,
  currentAttempt = 1
): Promise<Result<T, RetryError>> => {
  const result = await operation();

  if (result.success || currentAttempt >= options.maxRetries) {
    if (!result.success && currentAttempt >= options.maxRetries) {
      return {
        success: false,
        error: createRetryError(currentAttempt, result.error),
      };
    }
    return result.success
      ? result
      : {
          success: false,
          error: createRetryError(currentAttempt, result.error),
        };
  }

  await createExponentialDelay(currentAttempt);
  return executeWithRetry(operation, options, currentAttempt + 1);
};
