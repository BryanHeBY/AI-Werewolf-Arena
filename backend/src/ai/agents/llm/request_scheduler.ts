import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest } from "../../../core/domain/model";

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

/**
 * Per-provider keyed semaphore. The returned lease makes release ownership explicit
 * and prevents request orchestration from manipulating queue state directly.
 */
export class ScopedRequestScheduler {
  private readonly activeByScope = new Map<string, number>();
  private readonly waitersByScope = new Map<string, Array<() => void>>();

  constructor(private readonly options: RequestSchedulerOptions) {}

  async acquire(request: ActionRequest, role?: RoleComponent): Promise<() => void> {
    const scope = this.resolveScope(request, role);
    const limit = this.resolveLimit(request, role);
    const active = this.activeByScope.get(scope) ?? 0;

    if (Number.isFinite(limit) && active >= limit) {
      const queue = this.waitersByScope.get(scope) ?? [];
      this.waitersByScope.set(scope, queue);
      this.options.onWait?.({
        request,
        scope,
        queueDepth: queue.length + 1,
        active,
        limit,
      });
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    this.activeByScope.set(scope, (this.activeByScope.get(scope) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(scope);
    };
  }

  private resolveScope(request: ActionRequest, role?: RoleComponent): string {
    return this.options.scopeResolver?.(request, role)?.trim() || "default";
  }

  private resolveLimit(request: ActionRequest, role?: RoleComponent): number {
    const resolved = this.options.limitResolver?.(request, role);
    const value = typeof resolved === "number"
      ? resolved
      : this.options.defaultMaxConcurrentRequests;
    if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
    return Math.max(1, Math.floor(value));
  }

  private release(scope: string): void {
    const active = this.activeByScope.get(scope) ?? 0;
    if (active <= 1) this.activeByScope.delete(scope);
    else this.activeByScope.set(scope, active - 1);

    const queue = this.waitersByScope.get(scope);
    const next = queue?.shift();
    if (queue?.length === 0) this.waitersByScope.delete(scope);
    next?.();
  }
}
