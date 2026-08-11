import { PlayerVisibleEvent } from "../core/domain/model";
import {
  ReplayDebugReport,
  ReplayFinalizeMeta,
  ReplayLlmRequestMessage,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPhaseWindow,
  ReplayPhaseWindowsFile,
  ReplayPlayerDeltaMessage,
  ReplayPlayerEventEntry,
  ReplayPlayerView,
  ReplayPublicEvent,
  ReplayRecordDebugReportInput,
  ReplayRecordLogicOpInput,
  ReplayRecordPlayerEventInput,
  ReplayRecordPlayerRoundInput,
  ReplayRecordPublicEventInput,
  ReplaySessionMeta,
  ReplayTimelineIndexFile,
} from "./types";

const THINKING_MAX_CHARS = 4000;
const LLM_MESSAGE_MAX_CHARS = 8000;

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

export function safeReplayJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { non_serializable: true };
  }
}

function normalizeRequestMessages(
  messages: ReplayLlmRequestMessage[] | undefined,
): ReplayLlmRequestMessage[] | undefined {
  if (!messages?.length) return undefined;
  return messages.map((message) => ({
    role: message.role,
    content: message.content.slice(0, LLM_MESSAGE_MAX_CHARS),
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
  }));
}

function normalizeDeltaMessages(
  messages: ReplayPlayerDeltaMessage[] | undefined,
): ReplayPlayerDeltaMessage[] {
  return (messages ?? []).map((message) => ({
    ...message,
    ...(message.content
      ? { content: message.content.slice(0, LLM_MESSAGE_MAX_CHARS) }
      : {}),
    ...(message.args !== undefined
      ? { args: safeReplayJson(message.args) as Record<string, unknown> }
      : {}),
    ...(message.result !== undefined
      ? { result: safeReplayJson(message.result) as Record<string, unknown> | string }
      : {}),
  }));
}

/** In-memory aggregate and projection boundary for one replay session. */
export class ReplaySessionAggregate {
  private publicSeq = 0;
  private logicSeq = 0;
  private readonly publicEvents: ReplayPublicEvent[] = [];
  private readonly logicOps: ReplayLogicOp[] = [];
  private readonly debugReports: ReplayDebugReport[] = [];
  private readonly playerViews = new Map<number, ReplayPlayerView>();

  constructor(readonly sessionMeta: ReplaySessionMeta) {}

  recordPublicEvent(input: ReplayRecordPublicEventInput): void {
    this.publicEvents.push({
      seq: ++this.publicSeq,
      timestamp: toIso(input.timestampMs),
      phase: input.phase,
      day: input.day,
      ...(input.stage ? { stage: input.stage } : {}),
      type: input.type,
      payload: safeReplayJson(input.payload) as Record<string, unknown>,
    });
  }

  recordLogicOp(input: ReplayRecordLogicOpInput): void {
    this.logicOps.push({
      seq: ++this.logicSeq,
      timestamp: toIso(Date.now()),
      scope: input.scope,
      op: input.op,
      ...(input.actorId !== undefined ? { actor_id: input.actorId } : {}),
      ...(input.phase ? { phase: input.phase } : {}),
      ...(input.input ? { input: safeReplayJson(input.input) as Record<string, unknown> } : {}),
      ...(input.output ? { output: safeReplayJson(input.output) as Record<string, unknown> } : {}),
      status: input.status,
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }

  recordPlayerRound(input: ReplayRecordPlayerRoundInput): void {
    const view = this.ensurePlayerView(input.playerId, input.role, input.camp);
    if (!view.initial_prompt) {
      view.initial_prompt = {
        day: input.day,
        phase: input.phase,
        stage: input.stage,
        request_id: input.requestId,
        timestamp: toIso(input.timestampMs ?? Date.now()),
        ...(input.initialPromptSystem
          ? { prompt_system: input.initialPromptSystem }
          : input.promptSystem ? { prompt_system: input.promptSystem } : {}),
        ...(input.initialBoardInfo ? { board_info: input.initialBoardInfo } : {}),
        ...(input.promptUserDelta ? { prompt_user: [...input.promptUserDelta] } : {}),
      };
    }
    const requestMessages = normalizeRequestMessages(input.llmRequestMessages);
    const thinkingText = input.thinkingText?.slice(0, THINKING_MAX_CHARS);
    const deltaMessages = normalizeDeltaMessages(input.deltaMessages);
    if (deltaMessages.length === 0) {
      this.deriveRoundDeltaMessages(deltaMessages, input, requestMessages, thinkingText);
    }
    view.timeline.push({
      seq: view.timeline.length + 1,
      kind: "turn",
      day: input.day,
      phase: input.phase,
      stage: input.stage,
      request_id: input.requestId,
      timestamp: toIso(input.timestampMs ?? Date.now()),
      turn_seq: view.timeline.filter((entry) => entry.kind === "turn").length + 1,
      delta_messages: deltaMessages,
    });
  }

  recordPlayerEvent(input: ReplayRecordPlayerEventInput): void {
    const view = this.ensurePlayerView(input.playerId, input.role, input.camp);
    const entry: ReplayPlayerEventEntry = {
      seq: view.timeline.length + 1,
      kind: "event",
      day: input.day,
      phase: input.phase,
      stage: input.stage,
      request_id: input.requestId,
      timestamp: toIso(input.timestampMs ?? Date.now()),
      ...(input.sourceEventSeq === undefined
        ? {}
        : { source_event_seq: input.sourceEventSeq }),
      event: safeReplayJson(input.event) as unknown as PlayerVisibleEvent,
    };
    view.timeline.push(entry);
  }

  recordDebugReport(input: ReplayRecordDebugReportInput): string {
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
    return reportId;
  }

  publicTimelinePayload() { return { events: this.publicEvents }; }
  logicOpsPayload() { return { ops: this.logicOps }; }
  debugReportsPayload() {
    return {
      session_id: this.sessionMeta.sessionId,
      generated_at: new Date().toISOString(),
      reports: this.debugReports,
    };
  }
  playerIds(): number[] { return [...this.playerViews.keys()].sort((a, b) => a - b); }
  playerFiles(): string[] { return this.playerIds().map((id) => `players/player_${id}.json`); }
  normalizedPlayerView(playerId: number): ReplayPlayerView | undefined {
    const view = this.playerViews.get(playerId);
    return view ? this.normalizePlayerView(view) : undefined;
  }
  normalizedPlayerViews(): ReplayPlayerView[] {
    return this.playerIds().map((id) => this.normalizedPlayerView(id)!);
  }
  debugSummaryInput() {
    return {
      reports: this.debugReports,
      publicEvents: this.publicEvents,
      logicOps: this.logicOps,
      playerViews: this.normalizedPlayerViews(),
    };
  }

  buildManifest(meta?: ReplayFinalizeMeta): ReplayManifest {
    return {
      session_id: this.sessionMeta.sessionId,
      board: this.sessionMeta.board,
      started_at: this.sessionMeta.startedAtIso,
      ended_at: meta?.endedAtIso ?? this.sessionMeta.startedAtIso,
      winner: meta?.winner ?? null,
      finish_reason: meta?.finishReason ?? "in_progress",
      players: meta?.players ?? [],
      files: {
        replay: "replay.json",
        phase_windows: "phase_windows.json",
        timeline_index: "timeline_index.json",
        logic_ops: "logic_ops.json",
        debug_reports: "debug_reports.json",
        debug_summary: "debug_summary.md",
        player_views: this.playerFiles(),
      },
    };
  }

  phaseWindowsPayload(): ReplayPhaseWindowsFile {
    const windows: ReplayPhaseWindow[] = [];
    let current: ReplayPhaseWindow | null = null;
    for (const event of this.publicEvents) {
      const day = Number(event.day);
      const phase = String(event.phase);
      const seq = Number(event.seq);
      const stage = String(event.stage ?? event.type ?? "unknown");
      if (!current || current.day !== day || current.phase !== phase) {
        if (current) windows.push(current);
        current = {
          phase_id: `d${day}-${phase}`,
          day,
          phase,
          start_seq: seq,
          end_seq: seq,
          stages: [{ stage, start_seq: seq, end_seq: seq }],
        };
      } else {
        current.end_seq = seq;
        const last = current.stages.at(-1);
        if (last?.stage === stage) last.end_seq = seq;
        else current.stages.push({ stage, start_seq: seq, end_seq: seq });
      }
    }
    if (current) windows.push(current);
    return { session_id: this.sessionMeta.sessionId, windows };
  }

  timelineIndexPayload(): ReplayTimelineIndexFile {
    const count = this.publicEvents.length;
    const players: ReplayTimelineIndexFile["players"] = {};
    for (const [id, view] of this.playerViews) {
      players[String(id)] = { count: view.timeline.length };
    }
    return {
      session_id: this.sessionMeta.sessionId,
      public: {
        min_seq: count ? this.publicEvents[0].seq : 0,
        max_seq: count ? this.publicEvents.at(-1)!.seq : 0,
        count,
      },
      players,
      phases: { count: this.phaseWindowsPayload().windows.length },
    };
  }

  private ensurePlayerView(playerId: number, role: string, camp: string): ReplayPlayerView {
    const existing = this.playerViews.get(playerId);
    if (existing) return existing;
    const view: ReplayPlayerView = { player_id: playerId, role, camp, timeline: [] };
    this.playerViews.set(playerId, view);
    return view;
  }

  private normalizePlayerView(view: ReplayPlayerView): ReplayPlayerView {
    const initialPrompt = view.initial_prompt ?? this.deriveInitialPrompt(view);
    return {
      player_id: view.player_id,
      role: view.role,
      camp: view.camp,
      ...(initialPrompt ? { initial_prompt: initialPrompt } : {}),
      timeline: view.timeline,
    };
  }

  private deriveInitialPrompt(view: ReplayPlayerView): ReplayPlayerView["initial_prompt"] | undefined {
    const firstTurn = view.timeline.find((entry) => entry.kind === "turn");
    if (!firstTurn || firstTurn.kind !== "turn") return undefined;
    const system = firstTurn.delta_messages.find(
      (message) => message.role === "system" && message.content,
    );
    return system?.content
      ? {
          day: firstTurn.day,
          phase: firstTurn.phase,
          stage: firstTurn.stage,
          request_id: firstTurn.request_id,
          ...(firstTurn.timestamp ? { timestamp: firstTurn.timestamp } : {}),
          prompt_system: system.content,
        }
      : undefined;
  }

  private deriveRoundDeltaMessages(
    target: ReplayPlayerDeltaMessage[],
    input: ReplayRecordPlayerRoundInput,
    requestMessages: ReplayLlmRequestMessage[] | undefined,
    thinkingText: string | undefined,
  ): void {
    for (const message of requestMessages ?? []) {
      target.push({ role: message.role, kind: "prompt", content: message.content });
    }
    for (const item of input.retryTrace ?? []) {
      if (item.retryPrompt) target.push({
        role: "user", kind: "retry_prompt", attempt: item.attempt, content: item.retryPrompt,
      });
      if (item.assistantText) target.push({
        role: "assistant", kind: "assistant_output", attempt: item.attempt, content: item.assistantText,
      });
      if (item.reason) target.push({
        role: "meta",
        kind: item.status === "request_error" ? "request_error" : "constraint_warning",
        attempt: item.attempt,
        content: item.reason,
      });
    }
    if (thinkingText) target.push({ role: "assistant", kind: "assistant_output", content: thinkingText });
    for (const call of input.toolCalls) {
      target.push({
        role: "assistant",
        kind: "tool_call",
        name: call.name,
        ...(call.args !== undefined ? { args: safeReplayJson(call.args) as Record<string, unknown> } : {}),
        ...(call.accepted !== undefined ? { accepted: call.accepted } : {}),
      });
      if (call.result !== undefined) target.push({
        role: "tool",
        kind: "tool_result",
        name: call.name,
        result: safeReplayJson(call.result) as Record<string, unknown> | string,
      });
    }
    target.push({
      role: "meta",
      kind: "action_summary",
      content: JSON.stringify({
        action_mode: input.actionMode,
        final_action: input.finalAction !== undefined ? safeReplayJson(input.finalAction) : null,
      }),
    });
    if (input.fallback?.used) target.push({
      role: "meta",
      kind: "fallback",
      content: JSON.stringify(safeReplayJson(input.fallback)),
    });
  }
}
