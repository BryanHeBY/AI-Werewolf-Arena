import { promises as fs } from "fs";
import path from "path";
import {
  ReplayFinalizeMeta,
  ReplayLlmRequestMessage,
  ReplayLogicOp,
  ReplayManifest,
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
const LLM_MESSAGE_MAX_CHARS = 8000;

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
    if (llmRequestMessages) {
      const entries = llmRequestMessages.map((message) => ({
        seq: 0,
        kind: "llm_message" as const,
        day: input.day,
        phase: input.phase,
        stage: input.stage,
        request_id: input.requestId,
        timestamp: toIso(input.timestampMs ?? Date.now()),
        role: message.role,
        content: message.content,
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
      }));
      const hasLlmMessage = view.timeline.some((entry) => entry.kind === "llm_message");
      if (!hasLlmMessage) {
        // 首轮请求的 system/user 提示优先展示，保证 timeline 第一条就是 system prompt。
        view.timeline = [...entries, ...view.timeline];
        this.resequenceTimeline(view);
      } else {
        for (const entry of entries) {
          view.timeline.push({
            ...entry,
            seq: view.timeline.length + 1,
          });
        }
      }
    }

    if (input.thinkingText) {
      const thinkingText =
        input.thinkingText.length > THINKING_MAX_CHARS
          ? input.thinkingText.slice(0, THINKING_MAX_CHARS)
          : input.thinkingText;
      view.timeline.push({
        seq: view.timeline.length + 1,
        kind: "llm_message",
        day: input.day,
        phase: input.phase,
        stage: input.stage,
        request_id: input.requestId,
        timestamp: toIso(input.timestampMs ?? Date.now()),
        role: "assistant",
        content: thinkingText,
      });
    }

    for (const call of input.toolCalls) {
      view.timeline.push({
        seq: view.timeline.length + 1,
        kind: "tool_call",
        day: input.day,
        phase: input.phase,
        stage: input.stage,
        request_id: input.requestId,
        timestamp: toIso(input.timestampMs ?? Date.now()),
        role: "assistant",
        name: call.name,
        args: safeJson(call.args) as Record<string, unknown>,
        ...(call.accepted !== undefined ? { accepted: call.accepted } : {}),
        ...(call.result !== undefined ? { result: safeJson(call.result) as any } : {}),
      });
    }

    if (input.textAction) {
      view.timeline.push({
        seq: view.timeline.length + 1,
        kind: "text_action",
        day: input.day,
        phase: input.phase,
        stage: input.stage,
        request_id: input.requestId,
        timestamp: toIso(input.timestampMs ?? Date.now()),
        role: "assistant",
        content: input.textAction.text,
        ...(input.textAction.parsed_action
          ? { parsed_action: input.textAction.parsed_action }
          : {}),
      });
    }

    if (input.fallback?.used) {
      view.timeline.push({
        seq: view.timeline.length + 1,
        kind: "fallback",
        day: input.day,
        phase: input.phase,
        stage: input.stage,
        request_id: input.requestId,
        timestamp: toIso(input.timestampMs ?? Date.now()),
        role: "system",
        fallback: safeJson(input.fallback) as any,
      });
    }

    this.playerViews.set(input.playerId, view);
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
    const firstSystem = view.timeline.find(
      (entry) => entry.kind === "llm_message" && entry.role === "system",
    );
    if (!firstSystem || firstSystem.kind !== "llm_message") {
      return undefined;
    }
    return {
      day: firstSystem.day,
      phase: firstSystem.phase,
      stage: firstSystem.stage,
      request_id: firstSystem.request_id,
      ...(firstSystem.timestamp ? { timestamp: firstSystem.timestamp } : {}),
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
