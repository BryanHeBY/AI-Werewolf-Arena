import {
  AcpSession,
  AcpSessionCreateInput,
  AcpSessionFactory,
} from "../../integrations/acp/session";
import {
  ACP_CLOSE_TIMEOUT_MS,
  AcpInitializationCleanupError,
  closeAcpSession,
} from "../../integrations/acp/session_lifecycle";
import { awaitBeforeDeadline, awaitWithAbort } from "../../runtime/turn_deadline";

interface SessionEntry {
  promise: Promise<AcpSession>;
  created: Promise<AcpSession>;
  controller: AbortController;
  session?: AcpSession;
}

/** Owns reusable sessions, pending creations, discarded closes and late reclamation. */
export class AcpSessionPool {
  private readonly entries = new Map<number, SessionEntry>();
  private readonly creations = new Set<Promise<AcpSession>>();
  private readonly retiring = new Set<Promise<void>>();
  private readonly retired = new WeakMap<AcpSession, Promise<void>>();
  private readonly failures: unknown[] = [];
  private readonly discardedByActor = new Map<number, Promise<void>>();
  private closed = false;
  private unreclaimed = false;

  constructor(
    private readonly onDiscard: (actorId: number) => void,
    private readonly cleanupTimeoutMs = ACP_CLOSE_TIMEOUT_MS,
  ) {}
  get isClosed(): boolean {
    return this.closed;
  }
  get hasUnreclaimedResources(): boolean {
    return this.unreclaimed;
  }
  get snapshot() {
    return {
      closed: this.closed,
      sessions: this.entries.size,
      creating: this.creations.size,
      retiring: this.retiring.size,
    };
  }
  noteCleanupFailure(error: unknown): void {
    this.failures.push(error);
  }

  async getOrCreate(
    actorId: number,
    deadlineAtMs: number,
    prepare: () => { factory: AcpSessionFactory; input: AcpSessionCreateInput },
  ): Promise<AcpSession> {
    if (this.closed) throw new Error("acp_provider_closed");
    if (deadlineAtMs <= Date.now()) throw new Error("acp_deadline_elapsed");
    const existing = this.entries.get(actorId);
    if (existing) return existing.promise;
    const { factory, input } = prepare();
    if (this.closed) throw new Error("acp_provider_closed");
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("acp_initialize_timeout")),
      Math.max(0, deadlineAtMs - Date.now()),
    );
    const created = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return factory.createSession({ ...input, actorId, deadlineAtMs, signal: controller.signal });
    });
    this.creations.add(created);
    const entry: SessionEntry = {
      promise: awaitWithAbort(created, controller.signal),
      created,
      controller,
    };
    this.entries.set(actorId, entry);
    void created.then(
      (session) => {
        this.creations.delete(created);
        entry.session = session;
        if (controller.signal.aborted || this.closed || this.entries.get(actorId) !== entry)
          this.retire(session, true);
      },
      (error) => {
        this.creations.delete(created);
        // Real factories retain cleanup failures even when the caller already timed out.
        if (
          error instanceof AcpInitializationCleanupError ||
          (controller.signal.aborted && error !== controller.signal.reason)
        ) {
          this.failures.push(error);
          this.unreclaimed = true;
        }
      },
    );
    try {
      return await entry.promise;
    } catch (error) {
      if (this.entries.get(actorId) === entry) this.discard(actorId);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  discard(actorId: number): Promise<void> {
    const entry = this.entries.get(actorId);
    if (!entry) return this.discardedByActor.get(actorId) ?? Promise.resolve();
    this.entries.delete(actorId);
    entry.controller.abort(new Error("acp_session_discarded"));
    if (entry.session) this.retire(entry.session, true);
    try {
      this.onDiscard(actorId);
    } catch (error) {
      this.failures.push(error);
      this.unreclaimed = true;
    }
    const closing = awaitBeforeDeadline(async () => {
      const session = await entry.created.catch(() => null);
      if (session) await this.retire(session, true);
    }, Date.now() + this.cleanupTimeoutMs).catch((error) => {
      this.failures.push(error);
      this.unreclaimed = true;
    });
    this.discardedByActor.set(actorId, closing);
    this.retiring.add(closing);
    void closing.then(() => {
      this.retiring.delete(closing);
      if (this.discardedByActor.get(actorId) === closing) this.discardedByActor.delete(actorId);
    });
    return closing;
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const [actorId, entry] of this.entries) {
      entry.controller.abort(new Error("acp_provider_closed"));
      if (entry.session) this.retire(entry.session, false);
      try {
        this.onDiscard(actorId);
      } catch (error) {
        this.failures.push(error);
      }
    }
    this.entries.clear();
    try {
      await awaitBeforeDeadline(
        () => Promise.allSettled([...this.creations]),
        Date.now() + this.cleanupTimeoutMs,
      );
    } catch (error) {
      this.failures.push(error);
    }
    while (this.retiring.size) await Promise.all([...this.retiring]);
    const failures = this.failures.splice(0);
    if (failures.length) throw new AggregateError(failures, "acp_pool_close_failed");
  }

  private retire(session: AcpSession, force: boolean): Promise<void> {
    const existing = this.retired.get(session);
    if (existing) return existing;
    const closing = closeAcpSession(session, force, this.cleanupTimeoutMs).catch((error) => {
      this.failures.push(error);
      this.unreclaimed = true;
    });
    this.retired.set(session, closing);
    this.retiring.add(closing);
    void closing.then(() => this.retiring.delete(closing));
    return closing;
  }
}
