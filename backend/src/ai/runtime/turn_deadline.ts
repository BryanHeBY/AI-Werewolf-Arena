/**
 * 负责共享异步等待的绝对期限、中止竞争和有界收尾等待；输入为任务、时间戳和可选取消信号。
 * 输出为原结果、原拒绝或本等待的期限错误，只拥有计时器和监听器，不拥有底层会话／进程。
 * 期限由调用方先合并；中止只终结等待，迟到任务的回收和关闭仍由创建该资源的 owner 负责。
 */
export class TurnDeadlineElapsed extends Error {
  constructor() {
    super("request_deadline_elapsed");
  }
}

/** 只管理这一次等待；调用方传入绝对期限，undefined 表示此 helper 不另设期限。 */
export async function awaitBeforeDeadline<T>(
  start: () => Promise<T>,
  deadlineAtMs?: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw signal.reason;
  // 外部中止和期限计时器共用单向控制器；首次 abort 的原因不会被后续中止覆盖。
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
      // start 延至微任务执行，并在调用前检查取消；本 helper 不承诺抢占同步 start 的执行。
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return start();
      }),
      controller.signal,
    );
    // 即使任务先兑现，也在返回前复核此等待是否已中止；结果本身不代表资源已被关闭。
    controller.signal.throwIfAborted();
    return result;
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** 取消只拒绝外层等待；真实 task 仍被接住，迟到拒绝不会成为无人处理的 rejection。 */
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

/** 仅判断任务是否在窗口内成功兑现；拒绝或超时均为 false，不推断进程退出或资源已回收。 */
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
