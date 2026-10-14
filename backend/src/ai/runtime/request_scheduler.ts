/**
 * 负责按运行时并发 scope 排队和移交请求槽位；输入为请求、角色及可选取消信号，输出为释放函数。
 * active 记已授予的槽位，waiters 保存尚未授予的等待；每份租约只能有效释放一次。
 * scope／limit 在申请时解析，排队与移交仍检查原请求期限；租约不授予游戏行动或资源写权限。
 * close 单向拒绝排队和新申请，已授予槽位仍归调用方，在实际回合收尾后由其释放。
 */
import { RoleComponent } from "../../core/domain/components/role";
import { ActionRequest } from "../../core/domain";

export interface RequestSchedulerOptions {
  defaultMaxConcurrentRequests: number;
  scopeResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  limitResolver?: (request: ActionRequest, role?: RoleComponent) => number | undefined;
  onWait?: (event: {
    request: ActionRequest;
    scope: string;
    queueDepth: number;
    active: number;
    limit: number;
  }) => void;
}
/** 等待者按对象身份撤队；request／signal 保留原引用，移交时仍读取当时的取消与期限。 */
interface Waiter {
  request: ActionRequest;
  signal?: AbortSignal;
  grant: (release: () => void) => void;
  reject: (reason: unknown) => void;
  cleanup: () => void;
}

/** 同一 scope 内共享并发计数；释放函数是槽位所有权的收尾凭据，不是领域许可。 */
export class ScopedRequestScheduler {
  private readonly activeByScope = new Map<string, number>();
  private readonly waitersByScope = new Map<string, Waiter[]>();
  private closed = false;

  constructor(private readonly options: RequestSchedulerOptions) {}

  get snapshot(): { closed: boolean; active: number; queued: number } {
    return {
      closed: this.closed,
      active: [...this.activeByScope.values()].reduce((sum, count) => sum + count, 0),
      queued: [...this.waitersByScope.values()].reduce((sum, queue) => sum + queue.length, 0),
    };
  }

  async acquire(
    request: ActionRequest,
    role?: RoleComponent,
    signal?: AbortSignal,
  ): Promise<() => void> {
    if (this.closed) throw new DOMException("request_scheduler_closed", "AbortError");
    if (signal?.aborted) throw signal.reason;
    if ((request.deadlineAtMs ?? Infinity) <= Date.now())
      throw new Error("request_deadline_elapsed");
    const scope = this.resolveScope(request, role),
      limit = this.resolveLimit(request, role);
    const active = this.activeByScope.get(scope) ?? 0;
    if (!Number.isFinite(limit) || active < limit) {
      this.activeByScope.set(scope, active + 1);
      return this.lease(scope);
    }
    return new Promise<() => void>((resolve, reject) => {
      const queue = this.waitersByScope.get(scope) ?? [];
      this.waitersByScope.set(scope, queue);
      let timer: NodeJS.Timeout | undefined;
      const abort = () =>
        withdraw(signal?.reason ?? new DOMException("request_aborted", "AbortError"));
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      };
      const waiter: Waiter = { request, signal, grant: resolve, reject, cleanup };
      // 只移除仍在本队列中的这个 waiter；获授后旧取消回调不能再释放新 owner 的槽位。
      const withdraw = (reason: unknown) => {
        const current = this.waitersByScope.get(scope);
        const index = current?.indexOf(waiter) ?? -1;
        if (index < 0) return;
        current!.splice(index, 1);
        if (!current!.length) this.waitersByScope.delete(scope);
        cleanup();
        reject(reason);
      };
      queue.push(waiter);
      signal?.addEventListener("abort", abort, { once: true });
      if (request.deadlineAtMs !== undefined)
        timer = setTimeout(
          () => withdraw(new Error("request_deadline_elapsed")),
          Math.max(0, request.deadlineAtMs - Date.now()),
        );
      // 通知允许执行调用方代码；若通知抛错，仍按同一撤队路径清理，保留该原错误。
      try {
        this.options.onWait?.({ request, scope, queueDepth: queue.length, active, limit });
      } catch (error) {
        withdraw(error);
      }
      if (signal?.aborted) abort();
    });
  }

  close(reason: unknown = new DOMException("request_scheduler_closed", "AbortError")): void {
    if (this.closed) return;
    this.closed = true;
    for (const queue of this.waitersByScope.values())
      for (const waiter of queue) {
        waiter.cleanup();
        waiter.reject(reason);
      }
    this.waitersByScope.clear();
    // 关闭不替 active owner 中止模型或释放租约；计数保留到它们各自调用释放函数。
  }

  private lease(scope: string): () => void {
    let released = false;
    return () => {
      // 先封住本租约再移交槽位；重复释放不能减掉下一位等待者已接手的计数。
      if (!released) {
        released = true;
        this.release(scope);
      }
    };
  }

  private resolveScope(request: ActionRequest, role?: RoleComponent): string {
    return this.options.scopeResolver?.(request, role)?.trim() || "default";
  }

  private resolveLimit(request: ActionRequest, role?: RoleComponent): number {
    const resolved = this.options.limitResolver?.(request, role);
    const value =
      typeof resolved === "number" ? resolved : this.options.defaultMaxConcurrentRequests;
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : Infinity;
  }

  private release(scope: string): void {
    const queue = this.waitersByScope.get(scope);
    // 按队列顺序跳过已取消／已过期者；移交沿用同一个 active 槽位，不能先减数让新申请插队。
    while (queue?.length) {
      const next = queue.shift()!;
      next.cleanup();
      if (next.signal?.aborted || (next.request.deadlineAtMs ?? Infinity) <= Date.now()) {
        next.reject(
          next.signal?.aborted ? next.signal.reason : new Error("request_deadline_elapsed"),
        );
        continue;
      }
      if (!queue.length) this.waitersByScope.delete(scope);
      next.grant(this.lease(scope));
      return;
    }
    this.waitersByScope.delete(scope);
    const active = this.activeByScope.get(scope) ?? 0;
    if (active <= 1) this.activeByScope.delete(scope);
    else this.activeByScope.set(scope, active - 1);
  }
}
