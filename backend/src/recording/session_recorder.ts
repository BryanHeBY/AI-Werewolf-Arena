/** Session replay recording orchestration and incremental file persistence. */
import path from "path";
import type {
  DebugSummaryInput,
  ReplayFinalizeMeta,
  ReplayRecordDebugReportInput,
  ReplayRecordLogicOpInput,
  ReplayRecordPlayerEventInput,
  ReplayRecordPlayerRoundInput,
  ReplayRecordPublicEventInput,
  ReplaySessionMeta,
} from "./contracts";
import { createReplayDocument } from "./replay_document";
import { ReplayFileStore } from "./file_store";
import { ReplaySessionAggregate } from "./session_aggregate";
import { getSessionRecorder } from "./recording_context";
import { ReproductionTrace, type ReproductionFailureScope, type ReproductionMetadata } from "./reproduction";

const FLUSH_DEBOUNCE_MS = 100;

/**
 * Application service coordinating an in-memory replay aggregate with a file store.
 * Replay semantics live in ReplaySessionAggregate; storage semantics live in ReplayFileStore.
 */
export class SessionRecordManager {
  private closed = false;
  private closing = false;
  private dirtyPublicTimeline = false;
  private dirtyLogicOps = false;
  private dirtyDebugReports = false;
  private readonly dirtyPlayers = new Set<number>();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushChain: Promise<void> = Promise.resolve();
  private finalMeta: ReplayFinalizeMeta | null = null;
  private finalization: Promise<DebugSummaryInput> | null = null;
  private reproduction?: ReproductionTrace;
  private dirtyReproduction = false;
  private readonly mandatoryFlushFailures: unknown[] = [];

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

  beginReproduction(metadata: ReproductionMetadata): ReproductionTrace {
    if (this.closed || this.reproduction) throw new Error("reproduction_scope_already_started_or_closed");
    this.aggregate.enableReproduction();
    this.reproduction = new ReproductionTrace(metadata, () => {
      if (this.closed) return;
      this.dirtyReproduction = true;
      this.scheduleFlush();
    });
    return this.reproduction;
  }

  noteReproductionFailure(scope: ReproductionFailureScope, error: unknown): void { this.reproduction?.noteFailure(scope, error); }

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
    if (this.closed) return;
    if (this.closing) { await this.flushChain; return; }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.enqueueFlush();
  }

  finalize(meta: ReplayFinalizeMeta): Promise<DebugSummaryInput> {
    this.finalization ??= this.persistFinalRecord(meta);
    return this.finalization;
  }

  writeDebugSummary(markdown: string): Promise<void> {
    return this.store.writeText("debug_summary.md", markdown);
  }

  private async persistFinalRecord(meta: ReplayFinalizeMeta): Promise<DebugSummaryInput> {
    this.closing = true; // Prevent new timers before the first await.
    this.finalMeta = meta;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    await this.enqueueFlush();
    this.closed = true;

    const manifest = this.aggregate.buildManifest(meta);
    const replayDocument = this.buildReplayDocument(meta);
    const reproducible = () => {
      const input = this.aggregate.debugSummaryInput();
      const operations = (input.logicOps ?? []).filter(op => op.scope !== "llm_action_provider").map(({ seq: _seq, timestamp: _timestamp, ...op }) => op);
      return this.reproduction!.build({ operations, termination: { reason: meta.finishReason, winner: meta.winner } });
    };
    const required = await Promise.allSettled([
      this.store.writeJsonStrict("manifest.json", manifest),
      this.store.writeJsonStrict("replay.json", replayDocument),
      ...(this.reproduction ? [Promise.resolve().then(() => this.store.writeJsonStrict("reproduction.json", reproducible()))] : []),
    ]);
    await Promise.all([
      this.store.writeJson("phase_windows.json", this.aggregate.phaseWindowsPayload()),
      this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      this.store.writeJson("logic_ops.json", this.aggregate.logicOpsPayload()),
      this.store.writeJson("debug_reports.json", this.aggregate.debugReportsPayload()),
    ]);

    const playerViews = this.aggregate.normalizedPlayerViews();
    await Promise.all(playerViews.map((view) =>
      this.store.writeJson(`players/player_${view.player_id}.json`, view),
    ));

    const failures = [...this.mandatoryFlushFailures, ...required.filter((result): result is PromiseRejectedResult => result.status === "rejected").map(result => result.reason)];
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, "session_record_finalization_failed");

    return {
      manifest,
      ...this.aggregate.debugSummaryInput(),
      sessionDir: this.sessionDir,
    };
  }

  private async writeInitialFiles(): Promise<void> {
    const results = await Promise.allSettled([
      this.store.writeJsonStrict("manifest.json", this.aggregate.buildManifest()),
      this.store.writeJsonStrict("replay.json", this.buildReplayDocument()),
      this.store.writeJson("phase_windows.json", this.aggregate.phaseWindowsPayload()),
      this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      this.store.writeJson("logic_ops.json", this.aggregate.logicOpsPayload()),
      this.store.writeJson("debug_reports.json", this.aggregate.debugReportsPayload()),
    ]);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map(result => result.reason);
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, "session_record_initialization_failed");
  }

  private scheduleFlush(): void {
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
        console.warn(`[observability] replay_flush_failed err=${String(error)}`);
      });
    return this.flushChain;
  }

  private async flushDirtyFiles(): Promise<void> {
    if (this.closed) return;
    if (this.dirtyReproduction && this.reproduction) {
      this.dirtyReproduction = false;
      try { await this.store.writeJsonStrict("reproduction.json", this.reproduction.build()); }
      catch (error) { this.mandatoryFlushFailures.push(error); this.reproduction.noteFailure("recording", error); throw error; }
    }
    if (this.dirtyPublicTimeline) {
      this.dirtyPublicTimeline = false;
      await Promise.all([
        this.store.writeJson("replay.json", this.buildReplayDocument(this.finalMeta ?? undefined)),
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

  private buildReplayDocument(meta?: ReplayFinalizeMeta) {
    return createReplayDocument({
      manifest: this.aggregate.buildManifest(meta),
      events: this.aggregate.publicTimelinePayload().events,
    });
  }
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
  const active = getSessionRecorder();
  if (!active) return;
  try {
    active.recordLogicOp(input);
  } catch (error) {
    console.warn(`[observability] logic_op_record_failed op=${input.op} err=${String(error)}`);
  }
}
