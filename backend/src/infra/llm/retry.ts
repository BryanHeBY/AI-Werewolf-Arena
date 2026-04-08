export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  factor?: number;
}

export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const delayMs = options.delayMs ?? 200;
  const factor = options.factor ?? 2;

  let attempt = 0;
  let waitTime = delayMs;

  while (true) {
    try {
      return await task();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      waitTime *= factor;
    }
  }
}
