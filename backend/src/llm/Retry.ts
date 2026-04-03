/**
 * Exponential backoff retry utility
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  backoffFactor: number;
}

export const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = defaultRetryOptions,
): Promise<T> {
  let lastError: unknown;
  let delay = options.initialDelayMs;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(
        `Attempt ${attempt + 1}/${options.maxRetries + 1} failed:`,
        error,
      );

      if (attempt === options.maxRetries) {
        break;
      }

      console.log(`${delay}毫秒后重试...`);
      await sleep(delay);
      delay *= options.backoffFactor;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
