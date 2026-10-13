/**
 * 管理按玩家复用的 ACP 会话、在途创建和迟到回收，拥有创建中止控制器与关闭任务账本。
 * 输入为玩家、绝对期限及会话工厂；输出为复用或新建会话，关闭时汇总已记录的清理错误。
 * 不变量：会话只回收一次；丢弃先撤销复用入口，关闭后不再创建，超时后迟到的实例仍进入回收。
 * 协议与进程关闭由 session_lifecycle 执行，本池不负责游戏行动授权。
 */
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

// promise 是调用方受取消约束的等待；created 保留真实创建结果，供超时后的迟到回收使用。
interface SessionEntry {
  promise: Promise<AcpSession>;
  created: Promise<AcpSession>;
  controller: AbortController;
  session?: AcpSession;
}

/** 同一池拥有所有会话条目及清理账本；玩家丢弃回调只通知上层撤掉相关会话状态。 */
export class AcpSessionPool {
  private readonly entries = new Map<number, SessionEntry>();
  private readonly creations = new Set<Promise<AcpSession>>();
  private readonly retiring = new Set<Promise<void>>();
  // 按会话对象去重关闭；重复丢弃或迟到回调复用首次清理任务及其关闭方式。
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
    // prepare 可执行上层代码，返回后再次检查关闭，避免同步回调在准备期间关闭池。
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
        // 已取消、已关闭或条目被替换时，真实创建仍可能成功；迟到实例不可重新加入复用池。
        if (controller.signal.aborted || this.closed || this.entries.get(actorId) !== entry)
          this.retire(session, true);
      },
      (error) => {
        this.creations.delete(created);
        // 调用方超时后仍收集工厂的清理错误；与中止原因不同的迟到错误也保留为未回收证据。
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
    // 先撤掉复用入口再中止创建；后续调用不能取得这个已丢弃的条目。
    this.entries.delete(actorId);
    entry.controller.abort(new Error("acp_session_discarded"));
    if (entry.session) this.retire(entry.session, true);
    try {
      this.onDiscard(actorId);
    } catch (error) {
      this.failures.push(error);
      this.unreclaimed = true;
    }
    // 丢弃等待有独立清理期限；期限结束不抹掉 created，成功的迟到实例仍由上方回调回收。
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
    // 回收过程中可能加入新关闭任务，循环排空后才消费失败账本；不把超时当作资源已关闭。
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
