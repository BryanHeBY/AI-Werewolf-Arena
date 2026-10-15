/**
 * 负责单个录制会话的定时刷盘、串行队列和关闭状态；本实例是这些状态的唯一所有者。
 * 输入为管理器的实际刷盘函数、原失败告警以及首次终结调用；输出为原队列与终结 Promise。
 * closing 先阻止新定时器，closed 在最后前缀刷盘后由管理器写入；文件发布及必需失败账本仍由管理器负责。
 * 已排队刷盘沿同一 Promise 链串行执行；已存入的终结 Promise 仅复用，异步拒绝后不重试。
 * 队列失败交给原告警回调；回调正常返回才恢复队列，不清空必需失败，不决定归档内容或游戏规则。
 */
import type { DebugSummaryInput, ReplayFinalizeMeta } from "../contracts";

const FLUSH_DEBOUNCE_MS = 100;

export class SessionRecordingLifecycle {
  private closed = false;
  private closing = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushChain: Promise<void> = Promise.resolve();
  private finalMeta: ReplayFinalizeMeta | null = null;
  private finalization: Promise<DebugSummaryInput> | null = null;

  constructor(
    private readonly flushDirtyFiles: () => Promise<void>,
    private readonly warnFlushFailure: (error: unknown) => void,
  ) {}

  get isClosed(): boolean {
    return this.closed;
  }

  get isClosing(): boolean {
    return this.closing;
  }

  get finalMetadata(): ReplayFinalizeMeta | null {
    return this.finalMeta;
  }

  async flushNow(): Promise<void> {
    if (this.closed) return;
    if (this.closing) {
      // 只等待已排队的前缀，不把调用者绑定到后续文件发布或终结失败。
      await this.flushChain;
      return;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.enqueueFlush();
  }

  /** 非 async：重复调用返回首次 Promise；首次失败也不重试或替换归档元数据。 */
  finalize(persist: () => Promise<DebugSummaryInput>): Promise<DebugSummaryInput> {
    this.finalization ??= persist();
    return this.finalization;
  }

  /** 同步关定时入口并排入最后前缀；返回原队列，保留管理器原 await 时点。 */
  beginClosing(meta: ReplayFinalizeMeta): Promise<void> {
    this.closing = true;
    this.finalMeta = meta;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    return this.enqueueFlush();
  }

  /** 管理器仅在前缀队列结束后、最终必需文件发布之前调用。 */
  markClosed(): void {
    this.closed = true;
  }

  scheduleFlush(): void {
    if (this.closing || this.closed || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.closing || this.closed) return;
      void this.enqueueFlush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private enqueueFlush(): Promise<void> {
    this.flushChain = this.flushChain
      .then(() => this.flushDirtyFiles())
      .catch((error) => {
        this.warnFlushFailure(error);
      });
    return this.flushChain;
  }
}
