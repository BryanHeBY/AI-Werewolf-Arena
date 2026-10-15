/**
 * 负责单会话事件、玩家回合与诊断的原内存聚合；输入为录制数据，输出为原公开／玩家 schema 2 快照与清单。
 * 本 owner 写局部序号、原文片段、初始提示和操作计数；指定文本受字符上限约束，文件发布和严格身份仍由 manager／档案 codec 拥有。
 * 玩家规范化在原返回前作 canonical2 断言，保 timeline 同引用；不推进游戏或回收资源，序列化外的失败不回滚已发生的聚合前缀。
 */
import { assertReplayPlayerView, readVictoryResult, type CanonicalReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { PlayerVisibleEvent } from "../../domain/model";
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
} from "../contracts";

const THINKING_MAX_CHARS = 4000;
const LLM_MESSAGE_MAX_CHARS = 8000;

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

/**
 * 原 JSON stringify／parse 复制，执行 getter／toJSON 且沿 JSON 规则丢弃／转换值；任何该过程失败返回普通 sentinel 数据。
 * sentinel 不验证 schema、不授予权限，也不撤回序列化前已经发生的副作用；其他时间转换／聚合调用不在此 catch 内。
 */
export function safeReplayJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { non_serializable: true };
  }
}

/** 每行新建并截取 content，按原真值条件保 tool_call_id；不在这里过滤玩家可见性或重写协议历史。 */
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

/** 保原行的其余字段引用，只有 content 截取、args／result 经 JSON helper；不是整行深隔离或行动接受验证。 */
function normalizeDeltaMessages(
  messages: ReplayPlayerDeltaMessage[] | undefined,
): ReplayPlayerDeltaMessage[] {
  return (messages ?? []).map((message) => ({
    ...message,
    ...(message.content ? { content: message.content.slice(0, LLM_MESSAGE_MAX_CHARS) } : {}),
    ...(message.args !== undefined
      ? { args: safeReplayJson(message.args) as Record<string, unknown> }
      : {}),
    ...(message.result !== undefined
      ? { result: safeReplayJson(message.result) as Record<string, unknown> | string }
      : {}),
  }));
}

/** 同一会话的内存聚合与投影边界；各序列只在自己的记录点追加，刷盘／关闭与严格归档仍归外层管理器。 */
export class ReplaySessionAggregate {
  private reproductionEnabled = false;

  enableReproduction(): void {
    this.reproductionEnabled = true;
  }
  // 公共事件与逻辑操作各有独立计数器；玩家 timeline 另用自身长度，turn_seq 又只计 turn，不能互换证据序号。
  private publicSeq = 0;
  private logicSeq = 0;
  private readonly publicEvents: ReplayPublicEvent[] = [];
  private readonly logicOps: ReplayLogicOp[] = [];
  private readonly debugReports: ReplayDebugReport[] = [];
  private readonly playerViews = new Map<number, ReplayPlayerView>();

  constructor(readonly sessionMeta: ReplaySessionMeta) {}

  // seq 先递增，再转换 timestamp／payload；时间转换等未捕获失败可消耗序号而尚未 append，不在这里补偿。
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

  // 逻辑 seq 独立追加，event_count 仅保调用方传入的因果位置，不据此重新排序公开事件。
  recordLogicOp(input: ReplayRecordLogicOpInput): void {
    this.logicOps.push({
      seq: ++this.logicSeq,
      timestamp: toIso(Date.now()),
      scope: input.scope,
      op: input.op,
      ...(input.eventCount !== undefined ? { event_count: input.eventCount } : {}),
      ...(input.actorId !== undefined ? { actor_id: input.actorId } : {}),
      ...(input.phase ? { phase: input.phase } : {}),
      ...(input.input ? { input: safeReplayJson(input.input) as Record<string, unknown> } : {}),
      ...(input.output ? { output: safeReplayJson(input.output) as Record<string, unknown> } : {}),
      status: input.status,
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }

  /**
   * 先取得／登记玩家 view，尚无初始提示才记录；之后规范化或派生消息再追加 turn，已有 view／提示不因后续抛错回滚。
   * 仅 delta 为空时派生默认消息；显式 delta 不被默认轨迹覆盖，turn_seq 与混合 event/turn 的局部 seq 分开。
   */
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
          : input.promptSystem
            ? { prompt_system: input.promptSystem }
            : {}),
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

  // source_event_seq 是可选公共来源关联；entry.seq 仍为该玩家自己的混合时间线位置，不在此重新检查可见性。
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
      ...(input.sourceEventSeq === undefined ? {} : { source_event_seq: input.sourceEventSeq }),
      event: safeReplayJson(input.event) as unknown as PlayerVisibleEvent,
    };
    view.timeline.push(entry);
  }

  // 报告 ID 来自当前报告数量；证据数组浅复制、message 保原文，不在聚合点把上报判断为已确认 bug。
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

  // 这些 payload 只新建外层包装，事件／操作／报告数组仍属同一聚合，不是深快照或冻结结果。
  publicTimelinePayload() {
    return { events: this.publicEvents };
  }
  logicOpsPayload() {
    return { ops: this.logicOps };
  }
  debugReportsPayload() {
    return {
      session_id: this.sessionMeta.sessionId,
      generated_at: new Date().toISOString(),
      reports: this.debugReports,
    };
  }
  playerIds(): number[] {
    return [...this.playerViews.keys()].sort((a, b) => a - b);
  }
  playerFiles(): string[] {
    return this.playerIds().map((id) => `players/player_${id}.json`);
  }
  normalizedPlayerView(playerId: number): CanonicalReplayPlayerView | undefined {
    const view = this.playerViews.get(playerId);
    return view ? this.normalizePlayerView(view) : undefined;
  }
  normalizedPlayerViews(): CanonicalReplayPlayerView[] {
    return this.playerIds().map((id) => this.normalizedPlayerView(id)!);
  }
  /** 只按原 scope 排除 llm_action_provider；这是本聚合的操作计数，不校验或复演每条业务因果。 */
  get reproductionOperationCount(): number {
    return this.logicOps.filter((op) => op.scope !== "llm_action_provider").length;
  }
  debugSummaryInput() {
    return {
      reports: this.debugReports,
      publicEvents: this.publicEvents,
      logicOps: this.logicOps,
      playerViews: this.normalizedPlayerViews(),
    };
  }

  // 先由原结果 reader 校验 decision 与成员，再比 winner；失败不生成清单，成功仍沿原默认时间和文件声明。
  buildManifest(meta?: ReplayFinalizeMeta): ReplayManifest {
    const decision =
      meta?.gameResult === undefined
        ? undefined
        : readVictoryResult(
            meta.gameResult,
            meta.players.map((player) => player.player_id),
          );
    if (decision && decision.winner !== meta?.winner)
      throw new Error("replay_result_winner_mismatch");
    return {
      session_id: this.sessionMeta.sessionId,
      board: this.sessionMeta.board,
      ...(this.sessionMeta.locale === undefined ? {} : { locale: this.sessionMeta.locale }),
      ...(this.sessionMeta.random ? { random: this.sessionMeta.random } : {}),
      started_at: this.sessionMeta.startedAtIso,
      ended_at: meta?.endedAtIso ?? this.sessionMeta.startedAtIso,
      winner: meta?.winner ?? null,
      finish_reason: meta?.finishReason ?? "in_progress",
      ...(decision ? { game_result: decision as ReplayManifest["game_result"] } : {}),
      players: meta?.players ?? [],
      files: {
        ...(this.reproductionEnabled ? { reproduction: "reproduction.json" } : {}),
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

  /** 按现有事件顺序合并连续同 day／phase 及 stage；不排序，不把同名但分离的窗口全局合并。 */
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

  /** 公开 min/max 用实际首尾 seq；玩家只报各自 timeline 数量，阶段数量从原窗口投影取得。 */
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

  // 首次创建记录当时的 role／camp，后续原 view 保历史值，不跟随当前角色／阵营变化重写旧玩家文件元数据。
  private ensurePlayerView(playerId: number, role: string, camp: string): ReplayPlayerView {
    const existing = this.playerViews.get(playerId);
    if (existing) return existing;
    const view: ReplayPlayerView = {
      schemaVersion: 2,
      ...(this.sessionMeta.locale === undefined ? {} : { locale: this.sessionMeta.locale }),
      player_id: playerId,
      role,
      camp,
      timeline: [],
    };
    this.playerViews.set(playerId, view);
    return view;
  }

  // 新建 canonical2 包装但 timeline 保原数组；先补派生初始提示再断言，断言失败原样抛，不冻结或重写历史。
  private normalizePlayerView(view: ReplayPlayerView): CanonicalReplayPlayerView {
    const initialPrompt = view.initial_prompt ?? this.deriveInitialPrompt(view);
    const result: ReplayPlayerView = {
      schemaVersion: 2,
      ...(this.sessionMeta.locale === undefined ? {} : { locale: this.sessionMeta.locale }),
      player_id: view.player_id,
      role: view.role,
      camp: view.camp,
      ...(initialPrompt ? { initial_prompt: initialPrompt } : {}),
      timeline: view.timeline,
    };
    assertReplayPlayerView(result);
    return result;
  }

  /** 只从首个 turn 的首条真值 system 消息补提示；没有此消息就保持缺失，不猜测更早模型上下文。 */
  private deriveInitialPrompt(
    view: ReplayPlayerView,
  ): ReplayPlayerView["initial_prompt"] | undefined {
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

  /** 按原 prompt→重试／思考→tool call/result→行动摘要→fallback 次序派生；诊断 structuredClone 等未捕获失败保此前 target 前缀。 */
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
      if (item.retryPrompt)
        target.push({
          role: "user",
          kind: "retry_prompt",
          attempt: item.attempt,
          content: item.retryPrompt,
        });
      if (item.assistantText)
        target.push({
          role: "assistant",
          kind: "assistant_output",
          attempt: item.attempt,
          content: item.assistantText,
        });
      if (item.reason)
        target.push({
          role: "meta",
          kind: item.status === "request_error" ? "request_error" : "constraint_warning",
          attempt: item.attempt,
          content: item.reason,
          ...(item.diagnostic ? { diagnostic: structuredClone(item.diagnostic) } : {}),
        });
    }
    if (thinkingText)
      target.push({ role: "assistant", kind: "assistant_output", content: thinkingText });
    for (const call of input.toolCalls) {
      target.push({
        role: "assistant",
        kind: "tool_call",
        name: call.name,
        ...(call.args !== undefined
          ? { args: safeReplayJson(call.args) as Record<string, unknown> }
          : {}),
        ...(call.accepted !== undefined ? { accepted: call.accepted } : {}),
      });
      if (call.result !== undefined)
        target.push({
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
    if (input.fallback?.used)
      target.push({
        role: "meta",
        kind: "fallback",
        content: JSON.stringify(safeReplayJson(input.fallback)),
      });
  }
}
