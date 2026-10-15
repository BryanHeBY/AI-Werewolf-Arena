/**
 * 负责一个会话的复盘聚合、增量文件内容和终结发布；输入为事件、行动记录与结束元数据。
 * 输出为公开复盘、玩家视角和严格复现归档；聚合和存储仍由各自具体模块持有。
 * 生命周期模块唯一拥有定时器、队列、关闭与首次终结 Promise；本管理器保留必需失败账本。
 * 严格前缀写失败即登记，最终发布仍尝试完成；单个失败原样传播，多失败保持原顺序聚合。
 * 此处不控制游戏阶段或资源提交，不把可选诊断写入失败改成游戏错误。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import { formatErrorDiagnostic } from "../../utils/error-diagnostic";
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
} from "../contracts";
import {
  currentRecordingIdentities,
  createPublicReplayArchive,
  createReproductionArchive,
  createManifestArchive,
  createPlayerViewArchive,
} from "../archive-identity";
import { createReplayDocument } from "./replay-document";
import { ReplayFileStore } from "../../adapters/filesystem/session-file-store";
import { ReplaySessionAggregate } from "./aggregate";
import { getSessionRecorder } from "./context";
import { type ReproductionFailureScope, type ReproductionMetadata } from "../reproduction/format";
import { ReproductionTrace } from "../reproduction/trace";
import { SessionRecordingLifecycle } from "./lifecycle";

/** 文件内容、严格失败及归档发布的唯一编排者；刷盘排程由具体生命周期实例持有。 */
export class SessionRecordManager {
  private readonly lifecycle = new SessionRecordingLifecycle(
    () => this.flushDirtyFiles(),
    (error) => {
      console.warn(
        `[observability] replay_flush_failed err=${formatErrorDiagnostic(error, this.displayLocale)}`,
      );
    },
  );
  private dirtyPublicTimeline = false;
  private dirtyLogicOps = false;
  private dirtyDebugReports = false;
  private readonly dirtyPlayers = new Set<number>();
  private reproduction?: ReproductionTrace;
  private dirtyReproduction = false;
  // 公开初始化档尚无严格来源；beginReproduction 后只捕获实际元数据，不向历史档补写当前身份。
  private recordingIdentities = currentRecordingIdentities();
  private replayEventCursor?: () => number;
  setReplayEventCursor(cursor: () => number): void {
    if (this.replayEventCursor || this.reproduction)
      throw Error("reproduction_event_cursor_already_bound");
    this.replayEventCursor = cursor;
  }
  get reproductionSettlementCount(): number {
    return this.reproduction?.settlementCount ?? 0;
  }
  get reproductionDecisionCount(): number {
    return this.reproduction?.decisionCount ?? 0;
  }
  private readonly mandatoryFlushFailures: unknown[] = [];

  private constructor(
    private readonly aggregate: ReplaySessionAggregate,
    private readonly store: ReplayFileStore,
    readonly displayLocale: Locale,
  ) {}

  static async create(
    sessionMeta: ReplaySessionMeta,
    recordRootDir: string,
    displayLocale: Locale = sessionMeta.locale ?? "zh-CN",
  ): Promise<SessionRecordManager> {
    const store = new ReplayFileStore(
      path.join(recordRootDir, sessionMeta.sessionId),
      displayLocale,
    );
    const manager = new SessionRecordManager(
      new ReplaySessionAggregate(sessionMeta),
      store,
      displayLocale,
    );
    await store.initialize();
    await manager.writeInitialFiles();
    return manager;
  }

  get sessionId(): string {
    return this.aggregate.sessionMeta.sessionId;
  }
  /** 严格复现实际序列化的领域操作数，不包含 AI 诊断操作。 */
  get reproductionOperationCount(): number {
    return this.aggregate.reproductionOperationCount;
  }
  get sessionDir(): string {
    return this.store.sessionDir;
  }

  beginReproduction(
    metadata: ReproductionMetadata,
    liveEvents?: () => readonly import("../../domain").GameEvent[],
  ): ReproductionTrace {
    if (this.lifecycle.isClosed || this.reproduction)
      throw new Error("reproduction_scope_already_started_or_closed");
    this.aggregate.enableReproduction();
    this.reproduction = new ReproductionTrace(
      metadata,
      () => {
        if (this.lifecycle.isClosed) return;
        this.dirtyReproduction = true;
        this.lifecycle.scheduleFlush();
      },
      liveEvents,
    );
    // 不以来源声明驱动新刷盘；下次原公开发布或最终发布自然携带已捕获身份。
    this.recordingIdentities = currentRecordingIdentities(
      this.reproduction.recordedMetadataIdentity(),
    );
    return this.reproduction;
  }

  noteReproductionFailure(scope: ReproductionFailureScope, error: unknown): void {
    this.reproduction?.noteFailure(scope, error);
  }

  recordPublicEvent(input: ReplayRecordPublicEventInput): void {
    if (this.lifecycle.isClosed) return;
    this.aggregate.recordPublicEvent(input);
    this.dirtyPublicTimeline = true;
    this.lifecycle.scheduleFlush();
  }

  /** 必需因果输入在 closing 起即拒绝；普通诊断仍保留原有的关闭前追加语义。 */
  recordRequiredLogicOp(input: ReplayRecordLogicOpInput): void {
    if (this.lifecycle.isClosed || this.lifecycle.isClosing)
      throw new Error("mandatory_logic_op_recording_closed");
    this.recordLogicOp(input);
  }

  recordLogicOp(input: ReplayRecordLogicOpInput): void {
    if (this.lifecycle.isClosed) return;
    const eventCount = this.reproduction?.ownedEventCursor ?? this.replayEventCursor?.();
    this.aggregate.recordLogicOp(eventCount === undefined ? input : { ...input, eventCount });
    this.dirtyLogicOps = true;
    this.lifecycle.scheduleFlush();
  }

  recordPlayerRound(input: ReplayRecordPlayerRoundInput): void {
    if (this.lifecycle.isClosed) return;
    this.aggregate.recordPlayerRound(input);
    this.dirtyPlayers.add(input.playerId);
    this.lifecycle.scheduleFlush();
  }

  recordPlayerEvent(input: ReplayRecordPlayerEventInput): void {
    if (this.lifecycle.isClosed) return;
    this.aggregate.recordPlayerEvent(input);
    this.dirtyPlayers.add(input.playerId);
    this.lifecycle.scheduleFlush();
  }

  recordDebugReport(input: ReplayRecordDebugReportInput): string {
    if (this.lifecycle.isClosed) return "rb-closed";
    const reportId = this.aggregate.recordDebugReport(input);
    this.dirtyDebugReports = true;
    this.lifecycle.scheduleFlush();
    return reportId;
  }

  flushNow(): Promise<void> {
    return this.lifecycle.flushNow();
  }

  finalize(meta: ReplayFinalizeMeta): Promise<DebugSummaryInput> {
    return this.lifecycle.finalize(() => this.persistFinalRecord(meta));
  }

  writeDebugSummary(markdown: string): Promise<void> {
    return this.store.writeText("debug_summary.md", markdown);
  }

  private async persistFinalRecord(meta: ReplayFinalizeMeta): Promise<DebugSummaryInput> {
    // closing 在首个 await 前生效；前缀完成后关闭追加，再发布最终文件。
    await this.lifecycle.beginClosing(meta);
    this.lifecycle.markClosed();

    const manifest = this.aggregate.buildManifest(meta);
    const replayDocument = this.buildReplayArchive(meta);
    const reproducible = () => {
      const input = this.aggregate.debugSummaryInput();
      const operations = (input.logicOps ?? [])
        .filter((op) => op.scope !== "llm_action_provider")
        .map(({ seq: _seq, timestamp: _timestamp, ...op }) => op);
      return this.reproduction!.build({
        operations,
        termination: { reason: meta.finishReason, winner: meta.winner },
      });
    };
    const required = await Promise.allSettled([
      this.store.writeJsonStrict(
        "manifest.json",
        createManifestArchive(manifest, this.recordingIdentities),
      ),
      this.store.writeJsonStrict("replay.json", replayDocument),
      ...(this.reproduction
        ? [
            Promise.resolve().then(() =>
              this.store.writeJsonStrict(
                "reproduction.json",
                createReproductionArchive(reproducible()),
              ),
            ),
          ]
        : []),
    ]);
    await Promise.all([
      this.store.writeJson("phase_windows.json", this.aggregate.phaseWindowsPayload()),
      this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      this.store.writeJson("logic_ops.json", this.aggregate.logicOpsPayload()),
      this.store.writeJson("debug_reports.json", this.aggregate.debugReportsPayload()),
    ]);

    const playerViews = this.aggregate.normalizedPlayerViews();
    await Promise.all(
      playerViews.map((view) =>
        this.store.writeJson(
          `players/player_${view.player_id}.json`,
          createPlayerViewArchive(view, this.recordingIdentities),
        ),
      ),
    );

    // 已失败的严格前缀先列出，再列本次必需终档失败；成功发布不撤销旧失败。
    const failures = [
      ...this.mandatoryFlushFailures,
      ...required
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason),
    ];
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
      this.store.writeJsonStrict(
        "manifest.json",
        createManifestArchive(this.aggregate.buildManifest(), this.recordingIdentities),
      ),
      this.store.writeJsonStrict("replay.json", this.buildReplayArchive()),
      this.store.writeJson("phase_windows.json", this.aggregate.phaseWindowsPayload()),
      this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      this.store.writeJson("logic_ops.json", this.aggregate.logicOpsPayload()),
      this.store.writeJson("debug_reports.json", this.aggregate.debugReportsPayload()),
    ]);
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason);
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, "session_record_initialization_failed");
  }

  private async flushDirtyFiles(): Promise<void> {
    if (this.lifecycle.isClosed) return;
    if (this.dirtyReproduction && this.reproduction) {
      // 先消费本次脏位；严格失败登记在账本，后续仍可发布终档并报告此前失败。
      this.dirtyReproduction = false;
      try {
        await this.store.writeJsonStrict(
          "reproduction.json",
          createReproductionArchive(this.reproduction.build()),
        );
      } catch (error) {
        this.mandatoryFlushFailures.push(error);
        this.reproduction.noteFailure("recording", error);
        throw error;
      }
    }
    if (this.dirtyPublicTimeline) {
      this.dirtyPublicTimeline = false;
      await Promise.all([
        this.store.writeJson(
          "replay.json",
          this.buildReplayArchive(this.lifecycle.finalMetadata ?? undefined),
        ),
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
      await Promise.all(
        playerIds.map(async (playerId) => {
          const view = this.aggregate.normalizedPlayerView(playerId);
          if (view)
            await this.store.writeJson(
              `players/player_${playerId}.json`,
              createPlayerViewArchive(view, this.recordingIdentities),
            );
        }),
      );
      await Promise.all([
        this.store.writeJson(
          "manifest.json",
          createManifestArchive(
            this.aggregate.buildManifest(this.lifecycle.finalMetadata ?? undefined),
            this.recordingIdentities,
          ),
        ),
        this.store.writeJson("timeline_index.json", this.aggregate.timelineIndexPayload()),
      ]);
    }
  }

  private buildReplayArchive(meta?: ReplayFinalizeMeta) {
    return createPublicReplayArchive(
      createReplayDocument({
        manifest: this.aggregate.buildManifest(meta),
        events: this.aggregate.publicTimelinePayload().events,
      }),
      this.recordingIdentities,
    );
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
    console.warn(
      `[observability] logic_op_record_failed op=${input.op} err=${formatErrorDiagnostic(error, active.displayLocale)}`,
    );
  }
}
