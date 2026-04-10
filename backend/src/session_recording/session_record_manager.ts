import { promises as fs } from "fs";
import path from "path";
import {
  ReplayFinalizeMeta,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerActionEntry,
  ReplayPlayerBroadcastEntry,
  ReplayPlayerView,
  ReplayRecordLogicOpInput,
  ReplayRecordPlayerBroadcastInput,
  ReplayRecordPlayerRoundInput,
  ReplayRecordPublicEventInput,
  ReplaySessionMeta,
} from "./types";

const THINKING_MAX_CHARS = 4000;
const PROMPT_USER_MAX_CHARS = 4000;

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

/**
 * 对局复盘记录管理器：
 * - 以 session 为单位收集数据；
 * - 对局结束时一次性落盘为 JSON 文件。
 */
export class SessionRecordManager {
  private publicSeq = 0;
  private logicSeq = 0;
  private publicEvents: Array<any> = [];
  private logicOps: ReplayLogicOp[] = [];
  private playerViews = new Map<number, ReplayPlayerView>();
  private playerPromptSystemCache = new Map<number, string>();
  private closed = false;

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
      type: input.type,
      payload: safeJson(input.payload),
      ...(input.renderText ? { render_text: input.renderText } : {}),
    });
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
        ...(input.promptSystem ? { prompt_system: input.promptSystem } : {}),
        ...(input.promptUserDelta ? { prompt_user: [...input.promptUserDelta] } : {}),
      };
    }

    const nextSeq = (): number => view.timeline.length + 1;
    const actionSeqHint = nextSeq();
    const truncated: ReplayPlayerActionEntry["truncated"] = {};

    const thinkingText =
      input.thinkingText && input.thinkingText.length > THINKING_MAX_CHARS
        ? input.thinkingText.slice(0, THINKING_MAX_CHARS)
        : input.thinkingText;
    if (input.thinkingText && thinkingText !== input.thinkingText) {
      truncated.thinking_text = true;
    }

    const userDelta = input.promptUserDelta?.map((line) =>
      line.length > PROMPT_USER_MAX_CHARS
        ? line.slice(0, PROMPT_USER_MAX_CHARS)
        : line,
    );
    if (
      input.promptUserDelta &&
      userDelta &&
      input.promptUserDelta.some((line, idx) => line !== userDelta[idx])
    ) {
      truncated.prompt_user_delta = true;
    }

    const lastPromptSystem = this.playerPromptSystemCache.get(input.playerId);
    const actionEntry: ReplayPlayerActionEntry = {
      seq: nextSeq(),
      kind: "action",
      day: input.day,
      phase: input.phase,
      stage: input.stage,
      request_id: input.requestId,
      ...(input.feedCursorBefore !== undefined
        ? { feed_cursor_before: input.feedCursorBefore }
        : {}),
      ...(input.feedCursorAfter !== undefined
        ? { feed_cursor_after: input.feedCursorAfter }
        : {}),
      ...(input.promptSystem && input.promptSystem !== lastPromptSystem
        ? { prompt_system: input.promptSystem }
        : input.promptSystem
          ? { prompt_system_ref: `timeline_${Math.max(1, actionSeqHint - 1)}` }
          : {}),
      ...(userDelta ? { prompt_user_delta: userDelta } : {}),
      ...(thinkingText ? { thinking_text: thinkingText } : {}),
      action_mode: input.actionMode,
      tool_calls: input.toolCalls.map((call) => ({
        ...call,
        args: safeJson(call.args) as Record<string, unknown>,
        ...(call.result !== undefined ? { result: safeJson(call.result) as any } : {}),
      })),
      ...(input.textAction
        ? {
            text_action: {
              text: input.textAction.text,
              ...(input.textAction.parsed_action
                ? { parsed_action: input.textAction.parsed_action }
                : {}),
            },
          }
        : {}),
      ...(input.finalAction
        ? {
            final_action: {
              name: input.finalAction.name,
              args: safeJson((input.finalAction as any).args) as Record<string, unknown>,
            },
          }
        : {}),
      ...(input.fallback ? { fallback: safeJson(input.fallback) as any } : {}),
      ...(Object.keys(truncated).length > 0 ? { truncated } : {}),
    };

    view.timeline.push(actionEntry);
    this.playerViews.set(input.playerId, view);
    if (input.promptSystem) {
      this.playerPromptSystemCache.set(input.playerId, input.promptSystem);
    }
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
      text: input.text,
    };
    view.timeline.push(entry);
    this.playerViews.set(input.playerId, view);
  }

  async finalize(meta: ReplayFinalizeMeta): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const playerFiles = Array.from(this.playerViews.keys())
      .sort((a, b) => a - b)
      .map((id) => `players/player_${id}.json`);

    const manifest: ReplayManifest = {
      session_id: this.sessionMeta.sessionId,
      board: this.sessionMeta.board,
      started_at: this.sessionMeta.startedAtIso,
      ended_at: meta.endedAtIso,
      winner: meta.winner,
      finish_reason: meta.finishReason,
      players: meta.players,
      files: {
        public_timeline: "public_timeline.json",
        logic_ops: "logic_ops.json",
        player_views: playerFiles,
      },
      schema_version: "v1",
    };

    await this.writeJson("manifest.json", manifest);
    await this.writeJson("public_timeline.json", { events: this.publicEvents });
    await this.writeJson("logic_ops.json", { ops: this.logicOps });

    for (const [playerId, view] of this.playerViews.entries()) {
      const normalized = this.normalizePlayerView(view);
      await this.writeJson(path.join("players", `player_${playerId}.json`), normalized);
    }
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
    const firstAction = view.timeline.find((entry) => entry.kind === "action");
    if (!firstAction || firstAction.kind !== "action") {
      return undefined;
    }
    return {
      day: firstAction.day,
      phase: firstAction.phase,
      stage: firstAction.stage,
      request_id: firstAction.request_id,
      ...(firstAction.prompt_system ? { prompt_system: firstAction.prompt_system } : {}),
      ...(firstAction.prompt_user_delta
        ? { prompt_user: [...firstAction.prompt_user_delta] }
        : {}),
    };
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(path.join(this.sessionDir, "players"), { recursive: true });
  }

  private async writeJson(relativeFilePath: string, data: unknown): Promise<void> {
    const filePath = path.join(this.sessionDir, relativeFilePath);
    const tmpPath = `${filePath}.tmp`;
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, filePath);
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

export function resolveDefaultRecordRoot(cwd: string = process.cwd()): string {
  if (path.basename(cwd) === "backend") {
    return path.resolve(cwd, "..", "record");
  }
  return path.resolve(cwd, "record");
}

export function buildSessionId(now: number = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `session_${now}_${rand}`;
}

export function safeRecordLogicOp(input: ReplayRecordLogicOpInput): void {
  const active = SessionRecordHub.getActive();
  if (!active) {
    return;
  }
  try {
    active.recordLogicOp(input);
  } catch (error) {
    console.warn(
      `[session_recording] logic_op_record_failed op=${input.op} err=${String(error)}`,
    );
  }
}
