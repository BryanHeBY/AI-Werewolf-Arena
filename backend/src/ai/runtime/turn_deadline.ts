export class TurnDeadlineElapsed extends Error {
  constructor() {
    super("request_deadline_elapsed");
  }
}

/** Owns only a wait's timer/listener; the caller still owns the underlying resource. */
export async function awaitBeforeDeadline<T>(
  start: () => Promise<T>,
  deadlineAtMs?: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw signal.reason;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer =
    deadlineAtMs === undefined
      ? undefined
      : setTimeout(
          () => controller.abort(new TurnDeadlineElapsed()),
          Math.max(0, deadlineAtMs - Date.now()),
        );
  try {
    const result = await awaitWithAbort(
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return start();
      }),
      controller.signal,
    );
    controller.signal.throwIfAborted();
    return result;
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function awaitWithAbort<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("acp_operation_aborted"));
    if (signal.aborted) {
      void task.catch(() => undefined);
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    void task.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function settleWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise.then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
