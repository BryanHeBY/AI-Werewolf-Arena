/** 文件说明：会话复盘记录聚合、序列化与落盘管理。 */
import { promises as fs } from "fs";
import path from "path";
import {
  ReplayDebugReport,
  ReplayPlayerDeltaMessage,
  ReplayFinalizeMeta,
  ReplayLlmRequestMessage,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPhaseWindow,
  ReplayPhaseWindowsFile,
  ReplayPlayerBroadcastEntry,
  ReplayPlayerView,
  ReplayRecordLogicOpInput,
  ReplayRecordPlayerBroadcastInput,
  ReplayRecordDebugReportInput,
  ReplayRecordPlayerRoundInput,
  ReplayRecordPublicEventInput,
  ReplayTimelineIndexFile,
  ReplayPublicEvent,
  ReplaySessionMeta,
} from "./types";
import { buildDebugSummaryMarkdown } from "./debug_summary_generator";

const THINKING_MAX_CHARS = 4000;
const LLM_MESSAGE_MAX_CHARS = 8000;
const FLUSH_DEBOUNCE_MS = 100;

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function safeJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { non_serializable: true };
  }
}

function normalizeLlmRequestMessages(
  messages: ReplayLlmRequestMessage[] | undefined,
): ReplayLlmRequestMessage[] | undefined {
  if (!messages || messages.length === 0) {
    return undefined;
  }
  return messages.map((msg) => {
    const content =
      msg.content.length > LLM_MESSAGE_MAX_CHARS
        ? msg.content.slice(0, LLM_MESSAGE_MAX_CHARS)
        : msg.content;
    return {
      role: msg.role,
      content,
      ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
    };
  });
}

function normalizeDeltaMessages(
  messages: ReplayPlayerDeltaMessage[] | undefined,
): ReplayPlayerDeltaMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }
  return messages.map((msg) => ({
    ...msg,
    ...(msg.content
      ? {
          content:
            msg.content.length > LLM_MESSAGE_MAX_CHARS
              ? msg.content.slice(0, LLM_MESSAGE_MAX_CHARS)
              : msg.content,
        }
      : {}),
    ...(msg.args !== undefined
      ? { args: safeJson(msg.args) as Record<string, unknown> }
      : {}),
    ...(msg.result !== undefined
      ? { result: safeJson(msg.result) as Record<string, unknown> | string }
      : {}),
  }));
}

/**
 * 对局复盘记录管理器：
 * - 以 session 为单位收集数据；
 * - 对局结束时一次性落盘为 JSON 文件。
 */
export class SessionRecordManager {
  private publicSeq = 0;
  private logicSeq = 0;
  private publicEvents: ReplayPublicEvent[] = [];
  private logicOps: ReplayLogicOp[] = [];
  private debugReports: ReplayDebugReport[] = [];
  private playerViews = new Map<number, ReplayPlayerView>();
  private closed = false;
  private dirtyPublicTimeline = false;
  private dirtyLogicOps = false;
  private dirtyDebugReports = false;
  private dirtyPlayers = new Set<number>();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushChain: Promise<void> = Promise.resolve();
  private finalMeta: ReplayFinalizeMeta | null = null;

  private constructor(
    private readonly sessionMeta: ReplaySessionMeta,
    private readonly recordRootDir: string,
  ) {}

  static async create(
    sessionMeta: ReplaySessionMeta,
    recordRootDir: string,
  ): Promise<SessionRecordManager> {
    const manager = new SessionRecordManager(sessionMeta, recordRootDir);
    await manager.ensureDirs();
    await manager.writeInitialFiles();
    return manager;
  }

  get sessionId(): string {
    return this.sessionMeta.sessionId;
  }

  get sessionDir(): string {
    return path.join(this.recordRootDir, this.sessionMeta.sessionId);
  }

  recordPublicEvent(input: ReplayRecordPublicEventInput): void {
    if (this.closed) {
      return;
    }
    this.publicSeq += 1;
    this.publicEvents.push({
      seq: this.publicSeq,
      timestamp: toIso(input.timestampMs),
      phase: input.phase,
      day: input.day,
      ...(input.stage ? { stage: input.stage } : {}),
      type: input.type,
      payload: safeJson(input.payload) as Record<string, unknown>,
      ...(input.renderText ? { render_text: input.renderText } : {}),
    });
    this.dirtyPublicTimeline = true;
    this.scheduleFlush();
  }

  recordLogicOp(input: ReplayRecordLogicOpInput): void {
    if (this.closed) {
      return;
    }
    this.logicSeq += 1;
    this.logicOps.push({
      seq: this.logicSeq,
      timestamp: toIso(Date.now()),
      scope: input.scope,
      op: input.op,
      ...(input.actorId !== undefined ? { actor_id: input.actorId } : {}),
      ...(input.phase ? { phase: input.phase } : {}),
      ...(input.input ? { input: safeJson(input.input) as Record<string, unknown> } : {}),
      ...(input.output ? { output: safeJson(input.output) as Record<string, unknown> } : {}),
      status: input.status,
      ...(input.reason ? { reason: input.reason } : {}),
    });
    this.dirtyLogicOps = true;
    this.scheduleFlush();
  }

  recordPlayerRound(input: ReplayRecordPlayerRoundInput): void {
    if (this.closed) {
      return;
    }
    const existing = this.playerViews.get(input.playerId);
    const view: ReplayPlayerView =
      existing ??
      {
        player_id: input.playerId,
        role: input.role,
        camp: input.camp,
        timeline: [],
      };

    if (!view.initial_prompt) {
      view.initial_prompt = {
        day: input.day,
        phase: input.phase,
        stage: input.stage,
        request_id: input.requestId,
        timestamp: toIso(input.timestampMs ?? Date.now()),
        ...(input.initialPromptSystem
          ? { prompt_system: input.initialPromptSystem }
          : input.promptSystem
            ? { prompt_system: input.promptSystem }
            : {}),
        ...(input.initialBoardInfo ? { board_info: input.initialBoardInfo } : {}),
        ...(input.promptUserDelta ? { prompt_user: [...input.promptUserDelta] } : {}),
      };
    }

    const llmRequestMessages = normalizeLlmRequestMessages(input.llmRequestMessages);
    const thinkingText =
      input.thinkingText && input.thinkingText.length > THINKING_MAX_CHARS
        ? input.thinkingText.slice(0, THINKING_MAX_CHARS)
        : input.thinkingText;
    const deltaMessages = normalizeDeltaMessages(input.deltaMessages);
    if (deltaMessages.length === 0) {
      if (llmRequestMessages) {
        for (const message of llmRequestMessages) {
          deltaMessages.push({
            role: message.role,
            kind: "prompt",
            content: message.content,
          });
        }
      }
      if (input.retryTrace) {
        for (const item of input.retryTrace) {
          if (item.retryPrompt) {
            deltaMessages.push({
              role: "user",
              kind: "retry_prompt",
              attempt: item.attempt,
              content: item.retryPrompt,
            });
          }
          if (item.assistantText) {
            deltaMessages.push({
              role: "assistant",
              kind: "assistant_output",
              attempt: item.attempt,
              content: item.assistantText,
            });
          }
          if (item.status === "request_error" && item.reason) {
            deltaMessages.push({
              role: "meta",
              kind: "request_error",
              attempt: item.attempt,
              content: item.reason,
            });
          } else if (item.status === "no_valid_action" && item.reason) {
            deltaMessages.push({
              role: "meta",
              kind: "constraint_warning",
              attempt: item.attempt,
              content: item.reason,
            });
          }
        }
      }
      if (thinkingText) {
        deltaMessages.push({
          role: "assistant",
          kind: "assistant_output",
          content: thinkingText,
        });
      }
      for (const call of input.toolCalls) {
        deltaMessages.push({
          role: "assistant",
          kind: "tool_call",
          name: call.name,
          ...(call.args !== undefined
            ? { args: safeJson(call.args) as Record<string, unknown> }
            : {}),
          ...(call.accepted !== undefined ? { accepted: call.accepted } : {}),
        });
        if (call.result !== undefined) {
          deltaMessages.push({
            role: "tool",
            kind: "tool_result",
            name: call.name,
            result: safeJson(call.result) as Record<string, unknown> | string,
          });
        }
      }
      deltaMessages.push({
        role: "meta",
        kind: "action_summary",
        content: JSON.stringify({
          action_mode: input.actionMode,
          final_action:
            input.finalAction !== undefined ? safeJson(input.finalAction) : null,
          ...(input.textAction
            ? { text_action: safeJson(input.textAction) }
            : {}),
        }),
      });
      if (input.fallback?.used) {
        deltaMessages.push({
          role: "meta",
          kind: "fallback",
          content: JSON.stringify(safeJson(input.fallback)),
        });
      }
    }

    const turnSeq =
      view.timeline.filter((entry) => entry.kind === "turn").length + 1;
    view.timeline.push({
      seq: view.timeline.length + 1,
      kind: "turn",
      day: input.day,
      phase: input.phase,
      stage: input.stage,
      request_id: input.requestId,
      timestamp: toIso(input.timestampMs ?? Date.now()),
      turn_seq: turnSeq,
      delta_messages: deltaMessages,
    });

    this.playerViews.set(input.playerId, view);
    this.dirtyPlayers.add(input.playerId);
    this.scheduleFlush();
  }

  recordPlayerBroadcast(input: ReplayRecordPlayerBroadcastInput): void {
    if (this.closed) {
      return;
    }
    const existing = this.playerViews.get(input.playerId);
    const view: ReplayPlayerView =
      existing ??
      {
        player_id: input.playerId,
        role: input.role,
        camp: input.camp,
        timeline: [],
      };

    const entry: ReplayPlayerBroadcastEntry = {
      seq: view.timeline.length + 1,
      kind: "broadcast",
      day: input.day,
      phase: input.phase,
      stage: input.stage,
      request_id: input.requestId,
      timestamp: toIso(input.timestampMs ?? Date.now()),
      role: "user",
      content: input.text,
    };
    view.timeline.push(entry);
    this.playerViews.set(input.playerId, view);
    this.dirtyPlayers.add(input.playerId);
    this.scheduleFlush();
  }

  recordDebugReport(input: ReplayRecordDebugReportInput): string {
    if (this.closed) {
      return "rb-closed";
    }
    const reportId = `rb-${this.sessionMeta.sessionId}-${this.debugReports.length + 1}`;
    this.debugReports.push({
      report_id: reportId,
      timestamp: toIso(input.timestampMs ?? Date.now()),
      day: input.day,
      phase: input.phase,
      stage: input.stage,
      actor_id: input.actorId,
      actor_role: input.actorRole,
      actor_camp: input.actorCamp,
      category: input.category,
      severity: input.severity,
      message: input.message,
      evidence_event_seq: [...(input.evidenceEventSeq ?? [])],
      status: "open",
    });
    this.dirtyDebugReports = true;
    this.scheduleFlush();
    return reportId;
  }

  /**
   * 强制立即落盘当前脏数据（用于 finalize 与测试）。
   */
  async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.enqueueFlush();
  }

  async finalize(meta: ReplayFinalizeMeta): Promise<void> {
    if (this.closed) {
      return;
    }
    this.finalMeta = meta;
    await this.flushNow();
    this.closed = true;
    const playerFiles = Array.from(this.playerViews.keys())
      .sort((a, b) => a - b)
      .map((id) => `players/player_${id}.json`);

    const manifest: ReplayManifest = this.buildManifest({
      endedAtIso: meta.endedAtIso,
      winner: meta.winner,
      finishReason: meta.finishReason,
      players: meta.players,
      playerFiles,
    });

    await this.writeJson("manifest.json", manifest);
    await this.writeJson("public_timeline.json", { events: this.publicEvents });
    await this.writeJson("phase_windows.json", this.buildPhaseWindowsPayload());
    await this.writeJson("timeline_index.json", this.buildTimelineIndexPayload());
    await this.writeJson("logic_ops.json", { ops: this.logicOps });
    await this.writeJson("debug_reports.json", this.buildDebugReportsPayload());

    const normalizedPlayers: ReplayPlayerView[] = [];
    for (const [playerId, view] of this.playerViews.entries()) {
      const normalized = this.normalizePlayerView(view);
      normalizedPlayers.push(normalized);
      await this.writeJson(path.join("players", `player_${playerId}.json`), normalized);
    }

    const debugSummary = await buildDebugSummaryMarkdown({
      manifest,
      reports: this.debugReports,
      publicEvents: this.publicEvents.map((e) => ({
        seq: Number(e.seq ?? 0),
        day: Number(e.day ?? 0),
        phase: String(e.phase ?? ""),
        type: String(e.type ?? ""),
        payload: (e.payload ?? {}) as Record<string, unknown>,
        ...(e.render_text ? { render_text: e.render_text } : {}),
        timestamp: String(e.timestamp ?? ""),
      })),
      logicOps: this.logicOps,
      playerViews: normalizedPlayers,
      sessionDir: this.sessionDir,
    });
    await this.writeText("debug_summary.md", debugSummary);
  }

  private normalizePlayerView(view: ReplayPlayerView): ReplayPlayerView {
    const initialPrompt = view.initial_prompt ?? this.deriveInitialPromptFromTimeline(view);
    return {
      player_id: view.player_id,
      role: view.role,
      camp: view.camp,
      ...(initialPrompt ? { initial_prompt: initialPrompt } : {}),
      timeline: view.timeline,
    };
  }

  private deriveInitialPromptFromTimeline(
    view: ReplayPlayerView,
  ): ReplayPlayerView["initial_prompt"] | undefined {
    const firstTurn = view.timeline.find((entry) => entry.kind === "turn");
    if (!firstTurn || firstTurn.kind !== "turn") {
      return undefined;
    }
    const firstSystem = firstTurn.delta_messages.find(
      (message) => message.role === "system" && message.content,
    );
    if (!firstSystem) {
      return undefined;
    }
    return {
      day: firstTurn.day,
      phase: firstTurn.phase,
      stage: firstTurn.stage,
      request_id: firstTurn.request_id,
      ...(firstTurn.timestamp ? { timestamp: firstTurn.timestamp } : {}),
      prompt_system: firstSystem.content,
    };
  }

  private resequenceTimeline(view: ReplayPlayerView): void {
    for (let i = 0; i < view.timeline.length; i++) {
      view.timeline[i].seq = i + 1;
    }
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(path.join(this.sessionDir, "players"), { recursive: true });
  }

  private async writeInitialFiles(): Promise<void> {
    const manifest = this.buildManifest({
      endedAtIso: this.sessionMeta.startedAtIso,
      winner: null,
      finishReason: "in_progress",
      players: [],
      playerFiles: [],
    });
    await this.writeJson("manifest.json", manifest);
    await this.writeJson("public_timeline.json", { events: this.publicEvents });
    await this.writeJson("phase_windows.json", this.buildPhaseWindowsPayload());
    await this.writeJson("timeline_index.json", this.buildTimelineIndexPayload());
    await this.writeJson("logic_ops.json", { ops: this.logicOps });
    await this.writeJson("debug_reports.json", this.buildDebugReportsPayload());
  }

  private buildManifest(input: {
    endedAtIso: string;
    winner: ReplayManifest["winner"];
    finishReason: string;
    players: ReplayManifest["players"];
    playerFiles: string[];
  }): ReplayManifest {
    return {
      session_id: this.sessionMeta.sessionId,
      board: this.sessionMeta.board,
      started_at: this.sessionMeta.startedAtIso,
      ended_at: input.endedAtIso,
      winner: input.winner,
      finish_reason: input.finishReason,
      players: input.players,
      files: {
        public_timeline: "public_timeline.json",
        phase_windows: "phase_windows.json",
        timeline_index: "timeline_index.json",
        logic_ops: "logic_ops.json",
        debug_reports: "debug_reports.json",
        debug_summary: "debug_summary.md",
        player_views: input.playerFiles,
      },
      schema_version: "v1",
    };
  }

  private buildDebugReportsPayload(): Record<string, unknown> {
    return {
      session_id: this.sessionMeta.sessionId,
      generated_at: new Date().toISOString(),
      reports: this.debugReports,
    };
  }

  private scheduleFlush(): void {
    if (this.closed || this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.enqueueFlush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private enqueueFlush(): Promise<void> {
    this.flushChain = this.flushChain
      .then(async () => {
        await this.flushDirtyFiles();
      })
      .catch((error) => {
        console.warn(`[observability] realtime_flush_failed err=${String(error)}`);
      });
    return this.flushChain;
  }

  private async flushDirtyFiles(): Promise<void> {
    if (this.dirtyPublicTimeline) {
      this.dirtyPublicTimeline = false;
      await this.writeJson("public_timeline.json", { events: this.publicEvents });
      await this.writeJson("phase_windows.json", this.buildPhaseWindowsPayload());
      await this.writeJson("timeline_index.json", this.buildTimelineIndexPayload());
    }
    if (this.dirtyLogicOps) {
      this.dirtyLogicOps = false;
      await this.writeJson("logic_ops.json", { ops: this.logicOps });
    }
    if (this.dirtyDebugReports) {
      this.dirtyDebugReports = false;
      await this.writeJson("debug_reports.json", this.buildDebugReportsPayload());
    }
    if (this.dirtyPlayers.size > 0) {
      const dirtyPlayerIds = [...this.dirtyPlayers];
      this.dirtyPlayers.clear();
      for (const playerId of dirtyPlayerIds) {
        const view = this.playerViews.get(playerId);
        if (!view) {
          continue;
        }
        const normalized = this.normalizePlayerView(view);
        await this.writeJson(path.join("players", `player_${playerId}.json`), normalized);
      }
      // 会话进行中 manifest 也实时更新 player_views 列表。
      const playerFiles = Array.from(this.playerViews.keys())
        .sort((a, b) => a - b)
        .map((id) => `players/player_${id}.json`);
      const manifest = this.buildManifest({
        endedAtIso: this.finalMeta?.endedAtIso ?? this.sessionMeta.startedAtIso,
        winner: this.finalMeta?.winner ?? null,
        finishReason: this.finalMeta?.finishReason ?? "in_progress",
        players: this.finalMeta?.players ?? [],
        playerFiles,
      });
      await this.writeJson("manifest.json", manifest);
      await this.writeJson("timeline_index.json", this.buildTimelineIndexPayload());
    }
  }

  private buildPhaseWindowsPayload(): ReplayPhaseWindowsFile {
    const windows: ReplayPhaseWindow[] = [];
    let current: ReplayPhaseWindow | null = null;

    for (const event of this.publicEvents) {
      const day = Number(event.day);
      const phase = String(event.phase);
      const seq = Number(event.seq);
      const phaseId = `d${day}-${phase}`;
      const stage = String(event.stage ?? event.type ?? "unknown");
      if (!current || current.day !== day || current.phase !== phase) {
        if (current) {
          windows.push(current);
        }
        current = {
          phase_id: phaseId,
          day,
          phase,
          start_seq: seq,
          end_seq: seq,
          stages: [{ stage, start_seq: seq, end_seq: seq }],
        };
        continue;
      }
      current.end_seq = seq;
      const lastStage = current.stages[current.stages.length - 1];
      if (lastStage && lastStage.stage === stage) {
        lastStage.end_seq = seq;
      } else {
        current.stages.push({ stage, start_seq: seq, end_seq: seq });
      }
    }
    if (current) {
      windows.push(current);
    }

    return {
      session_id: this.sessionMeta.sessionId,
      windows,
    };
  }

  private buildTimelineIndexPayload(): ReplayTimelineIndexFile {
    const publicCount = this.publicEvents.length;
    const minSeq = publicCount > 0 ? this.publicEvents[0].seq : 0;
    const maxSeq = publicCount > 0 ? this.publicEvents[publicCount - 1].seq : 0;
    const players: ReplayTimelineIndexFile["players"] = {};
    for (const [playerId, view] of this.playerViews.entries()) {
      players[String(playerId)] = { count: view.timeline.length };
    }
    return {
      session_id: this.sessionMeta.sessionId,
      public: {
        min_seq: minSeq,
        max_seq: maxSeq,
        count: publicCount,
      },
      players,
      phases: {
        count: this.buildPhaseWindowsPayload().windows.length,
      },
    };
  }

  private async writeJson(relativeFilePath: string, data: unknown): Promise<void> {
    const filePath = path.join(this.sessionDir, relativeFilePath);
    const tmpPath = `${filePath}.tmp`;
    try {
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(tmpPath, content, "utf-8");
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      console.warn(
        `[observability] write_json_failed file=${relativeFilePath} err=${String(error)}`,
      );
    }
  }

  private async writeText(relativeFilePath: string, data: string): Promise<void> {
    const filePath = path.join(this.sessionDir, relativeFilePath);
    const tmpPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tmpPath, data, "utf-8");
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      console.warn(
        `[observability] write_text_failed file=${relativeFilePath} err=${String(error)}`,
      );
    }
  }
}

/**
 * 当前进程全局记录器注册中心。
 */
export class SessionRecordHub {
  private static active: SessionRecordManager | null = null;

  static setActive(manager: SessionRecordManager | null): void {
    this.active = manager;
  }

  static getActive(): SessionRecordManager | null {
    return this.active;
  }
}

/** 解析默认复盘输出目录。 */
export function resolveDefaultRecordRoot(cwd: string = process.cwd()): string {
  if (path.basename(cwd) === "backend") {
    return path.resolve(cwd, "..", "record");
  }
  return path.resolve(cwd, "record");
}

/** 生成会话 ID。 */
export function buildSessionId(now: number = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `session_${now}_${rand}`;
}

/** 安全写入逻辑操作（无 active manager 时静默跳过）。 */
export function safeRecordLogicOp(input: ReplayRecordLogicOpInput): void {
  const active = SessionRecordHub.getActive();
  if (!active) {
    return;
  }
  try {
    active.recordLogicOp(input);
  } catch (error) {
    console.warn(
      `[observability] logic_op_record_failed op=${input.op} err=${String(error)}`,
    );
  }
}
