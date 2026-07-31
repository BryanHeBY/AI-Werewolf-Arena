/** Session replay recording orchestration and realtime persistence. */
import path from "path";
import {
  ReplayFinalizeMeta,
  ReplayRecordDebugReportInput,
  ReplayRecordLogicOpInput,
  ReplayRecordPlayerEventInput,
  ReplayRecordPlayerRoundInput,
  ReplayRecordPublicEventInput,
  ReplaySessionMeta,
} from "./types";
import { buildDebugSummaryMarkdown } from "./debug_summary_generator";
import { ReplayFileStore } from "./replay_file_store";
import { ReplaySessionAggregate } from "./replay_session_aggregate";

const FLUSH_DEBOUNCE_MS = 100;

/**
 * Application service coordinating an in-memory replay aggregate with a file store.
 * Replay semantics live in ReplaySessionAggregate; storage semantics live in ReplayFileStore.
 */
export class SessionRecordManager {
  private closed = false;
  private dirtyPublicTimeline = false;
  private dirtyLogicOps = false;
  private dirtyDebugReports = false;
  private readonly dirtyPlayers = new Set<number>();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushChain: Promise<void> = Promise.resolve();
  private finalMeta: ReplayFinalizeMeta | null = null;

  private constructor(
    private readonly aggregate: ReplaySessionAggregate,
    private readonly store: ReplayFileStore,
  ) {}

  static async create(
    sessionMeta: ReplaySessionMeta,
    recordRootDir: string,
  ): Promise<SessionRecordManager> {
    const store = new ReplayFileStore(path.join(recordRootDir, sessionMeta.sessionId));
    const manager = new SessionRecordManager(
      new ReplaySessionAggregate(sessionMeta),
      store,
    );
    await store.initialize();
    await manager.writeInitialFiles();
    return manager;
  }

  get sessionId(): string { return this.aggregate.sessionMeta.sessionId; }
  get sessionDir(): string { return this.store.sessionDir; }

  recordPublicEvent(input: ReplayRecordPublicEventInput): void {
    if (this.closed) return;
    this.aggregate.recordPublicEvent(input);
    this.dirtyPublicTimeline = true;
    this.scheduleFlush();
  }

  recordLogicOp(input: ReplayRecordLogicOpInput): void {
    if (this.closed) return;
    this.aggregate.recordLogicOp(input);
    this.dirtyLogicOps = true;
    this.scheduleFlush();
  }

  recordPlayerRound(input: ReplayRecordPlayerRoundInput): void {
    if (this.closed) return;
    this.aggregate.recordPlayerRound(input);
    this.dirtyPlayers.add(input.playerId);
    this.scheduleFlush();
  }

  recordPlayerEvent(input: ReplayRecordPlayerEventInput): void {
    if (this.closed) return;
    this.aggregate.recordPlayerEvent(input);
    this.dirtyPlayers.add(input.playerId);
    this.scheduleFlush();
  }

  recordDebugReport(input: ReplayRecordDebugReportInput): string {
    if (this.closed) return "rb-closed";
    const reportId = this.aggregate.recordDebugReport(input);
    this.dirtyDebugReports = true;
    this.scheduleFlush();
    return reportId;
  }

  async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.enqueueFlush();
  }

  async finalize(meta: ReplayFinalizeMeta): Promise<void> {
    if (this.closed) return;
    this.finalMeta = meta;
    await this.flushNow();
    this.closed = true;

    const manifest = this.aggregate.buildManifest(meta);
    await Promise.all([
      this.store.writeJson("manifest.json", manifest),
      this.store.writeJson("public_timeline.json", this.aggregate.publicTimelinePayload()),
      this.store.writeJson("phase_windows.json", this.aggregate.phaseWindowsPayload()),
      this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      this.store.writeJson("logic_ops.json", this.aggregate.logicOpsPayload()),
      this.store.writeJson("debug_reports.json", this.aggregate.debugReportsPayload()),
    ]);

    const playerViews = this.aggregate.normalizedPlayerViews();
    await Promise.all(playerViews.map((view) =>
      this.store.writeJson(`players/player_${view.player_id}.json`, view),
    ));

    const snapshot = this.aggregate.debugSummaryInput();
    const debugSummary = await buildDebugSummaryMarkdown({
      manifest,
      ...snapshot,
      sessionDir: this.sessionDir,
    });
    await this.store.writeText("debug_summary.md", debugSummary);
  }

  private async writeInitialFiles(): Promise<void> {
    await Promise.all([
      this.store.writeJson("manifest.json", this.aggregate.buildManifest()),
      this.store.writeJson("public_timeline.json", this.aggregate.publicTimelinePayload()),
      this.store.writeJson("phase_windows.json", this.aggregate.phaseWindowsPayload()),
      this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      this.store.writeJson("logic_ops.json", this.aggregate.logicOpsPayload()),
      this.store.writeJson("debug_reports.json", this.aggregate.debugReportsPayload()),
    ]);
  }

  private scheduleFlush(): void {
    if (this.closed || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.enqueueFlush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private enqueueFlush(): Promise<void> {
    this.flushChain = this.flushChain
      .then(() => this.flushDirtyFiles())
      .catch((error) => {
        console.warn(`[observability] realtime_flush_failed err=${String(error)}`);
      });
    return this.flushChain;
  }

  private async flushDirtyFiles(): Promise<void> {
    if (this.dirtyPublicTimeline) {
      this.dirtyPublicTimeline = false;
      await Promise.all([
        this.store.writeJson("public_timeline.json", this.aggregate.publicTimelinePayload()),
        this.store.writeJson("phase_windows.json", this.aggregate.phaseWindowsPayload()),
        this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      ]);
    }
    if (this.dirtyLogicOps) {
      this.dirtyLogicOps = false;
      await this.store.writeJson("logic_ops.json", this.aggregate.logicOpsPayload());
    }
    if (this.dirtyDebugReports) {
      this.dirtyDebugReports = false;
      await this.store.writeJson("debug_reports.json", this.aggregate.debugReportsPayload());
    }
    if (this.dirtyPlayers.size > 0) {
      const playerIds = [...this.dirtyPlayers];
      this.dirtyPlayers.clear();
      await Promise.all(playerIds.map(async (playerId) => {
        const view = this.aggregate.normalizedPlayerView(playerId);
        if (view) await this.store.writeJson(`players/player_${playerId}.json`, view);
      }));
      await Promise.all([
        this.store.writeJson("manifest.json", this.aggregate.buildManifest(this.finalMeta ?? undefined)),
        this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      ]);
    }
  }
}

/** Current-process replay recorder registry. */
export class SessionRecordHub {
  private static active: SessionRecordManager | null = null;

  static setActive(manager: SessionRecordManager | null): void { this.active = manager; }
  static getActive(): SessionRecordManager | null { return this.active; }
}

export function resolveDefaultRecordRoot(cwd: string = process.cwd()): string {
  return path.basename(cwd) === "backend"
    ? path.resolve(cwd, "..", "record")
    : path.resolve(cwd, "record");
}

export function buildSessionId(now: number = Date.now()): string {
  return `session_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

export function safeRecordLogicOp(input: ReplayRecordLogicOpInput): void {
  const active = SessionRecordHub.getActive();
  if (!active) return;
  try {
    active.recordLogicOp(input);
  } catch (error) {
    console.warn(`[observability] logic_op_record_failed op=${input.op} err=${String(error)}`);
  }
}
