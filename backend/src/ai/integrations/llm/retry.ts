/**
 * 重试策略配置。
 */
export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  factor?: number;
}

/**
 * 指数退避重试工具：
 * 适用于调用 LLM/网络接口时的瞬时失败恢复。
 */
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
      const message = String(error);
      if (
        message.includes("AbortError") ||
        message.includes("aborted") ||
        message.includes("The operation was aborted")
      ) {
        throw error;
      }
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      const sleepMs = isRateLimitedError(message)
        ? computeRateLimitBackoffWithJitter(waitTime, attempt)
        : waitTime;
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
      waitTime *= factor;
    }
  }
}

function isRateLimitedError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("429") ||
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("token plan")
  );
}

function computeRateLimitBackoffWithJitter(
  waitTime: number,
  attempt: number,
): number {
  // 对 429 使用更保守的等待窗口，并加抖动避免并发请求“同一时刻重试”。
  const rateBase = Math.max(waitTime * 2, 800 * Math.pow(2, attempt - 1));
  const jitterFactor = 0.5 + Math.random(); // [0.5, 1.5)
  const backoff = Math.floor(rateBase * jitterFactor);
  return Math.min(backoff, 15000);
}
