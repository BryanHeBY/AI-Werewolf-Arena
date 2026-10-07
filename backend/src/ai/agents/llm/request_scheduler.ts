import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest } from "../../../core/domain";

export interface RequestSchedulerOptions {
  defaultMaxConcurrentRequests: number;
  scopeResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  limitResolver?: (request: ActionRequest, role?: RoleComponent) => number | undefined;
  onWait?: (event: { request: ActionRequest; scope: string; queueDepth: number; active: number; limit: number }) => void;
}
interface Waiter {
  request: ActionRequest;
  signal?: AbortSignal;
  grant: (release: () => void) => void;
  reject: (reason: unknown) => void;
  cleanup: () => void;
}

/** Per-runtime provider semaphore. A lease has one owner; queued work is cancellable. */
export class ScopedRequestScheduler {
  private readonly activeByScope = new Map<string, number>();
  private readonly waitersByScope = new Map<string, Waiter[]>();
  private closed = false;

  constructor(private readonly options: RequestSchedulerOptions) {}

  get snapshot(): { closed: boolean; active: number; queued: number } {
    return { closed: this.closed,
      active: [...this.activeByScope.values()].reduce((sum, count) => sum + count, 0),
      queued: [...this.waitersByScope.values()].reduce((sum, queue) => sum + queue.length, 0) };
  }

  async acquire(request: ActionRequest, role?: RoleComponent, signal?: AbortSignal): Promise<() => void> {
    if (this.closed) throw new DOMException("request_scheduler_closed", "AbortError");
    if (signal?.aborted) throw signal.reason;
    if ((request.deadlineAtMs ?? Infinity) <= Date.now()) throw new Error("request_deadline_elapsed");
    const scope = this.resolveScope(request, role), limit = this.resolveLimit(request, role);
    const active = this.activeByScope.get(scope) ?? 0;
    if (!Number.isFinite(limit) || active < limit) {
      this.activeByScope.set(scope, active + 1);
      return this.lease(scope);
    }
    return new Promise<() => void>((resolve, reject) => {
      const queue = this.waitersByScope.get(scope) ?? [];
      this.waitersByScope.set(scope, queue);
      let timer: NodeJS.Timeout | undefined;
      const abort = () => withdraw(signal?.reason ?? new DOMException("request_aborted", "AbortError"));
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      };
      const waiter: Waiter = { request, signal, grant: resolve, reject, cleanup };
      const withdraw = (reason: unknown) => {
        const current = this.waitersByScope.get(scope);
        const index = current?.indexOf(waiter) ?? -1;
        if (index < 0) return;
        current!.splice(index, 1);
        if (!current!.length) this.waitersByScope.delete(scope);
        cleanup(); reject(reason);
      };
      queue.push(waiter);
      signal?.addEventListener("abort", abort, { once: true });
      if (request.deadlineAtMs !== undefined) timer = setTimeout(() => withdraw(new Error("request_deadline_elapsed")), Math.max(0, request.deadlineAtMs - Date.now()));
      try { this.options.onWait?.({ request, scope, queueDepth: queue.length, active, limit }); }
      catch (error) { withdraw(error); }
      if (signal?.aborted) abort();
    });
  }

  close(reason: unknown = new DOMException("request_scheduler_closed", "AbortError")): void {
    if (this.closed) return;
    this.closed = true;
    for (const queue of this.waitersByScope.values()) for (const waiter of queue) {
      waiter.cleanup(); waiter.reject(reason);
    }
    this.waitersByScope.clear();
    // Active slots remain accounted for until their owners release them.
  }

  private lease(scope: string): () => void {
    let released = false;
    return () => { if (!released) { released = true; this.release(scope); } };
  }

  private resolveScope(request: ActionRequest, role?: RoleComponent): string {
    return this.options.scopeResolver?.(request, role)?.trim() || "default";
  }

  private resolveLimit(request: ActionRequest, role?: RoleComponent): number {
    const resolved = this.options.limitResolver?.(request, role);
    const value = typeof resolved === "number" ? resolved : this.options.defaultMaxConcurrentRequests;
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : Infinity;
  }

  private release(scope: string): void {
    const queue = this.waitersByScope.get(scope);
    while (queue?.length) {
      const next = queue.shift()!;
      next.cleanup();
      if (next.signal?.aborted || (next.request.deadlineAtMs ?? Infinity) <= Date.now()) {
        next.reject(next.signal?.aborted ? next.signal.reason : new Error("request_deadline_elapsed"));
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
