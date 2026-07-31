import { ActionRequest, EntityId, PlayerVisibleEvent, ToolName } from "../../../core/domain/model";
import { encodePlayerVisibleEvent, parsePlayerVisibleEvents } from "../visible_event_protocol";
import { BuiltPlayerPrompt, ChatMessage } from "./model_client";
import { PlayerPromptPolicy } from "./player_prompt_policy";

export interface PlayerPromptSessionOptions {
  maxPromptEvents: number;
  supportsNativeTools: boolean;
  promptPolicy: PlayerPromptPolicy;
}

/** Append-only owner of per-player visible history, event cursors and stable prompts. */
export class PlayerPromptSession {
  static readonly REPORT_BUG_TOOL: ToolName = "report_bug";

  private readonly histories = new Map<EntityId, ChatMessage[]>();
  private readonly eventCursors = new Map<EntityId, number>();
  private readonly toolTurnCounters = new Map<EntityId, number>();
  private readonly systemPrompts = new Map<EntityId, string>();

  constructor(private readonly options: PlayerPromptSessionOptions) {}

  build(request: ActionRequest): BuiltPlayerPrompt {
    const eventDelta = this.ingestVisibleEvents(request);
    const fullHistory = [...(this.histories.get(request.actorId) ?? [])];
    const contextWindow = this.selectHistoryWindow(fullHistory);
    const isInitialRound = !this.systemPrompts.has(request.actorId);
    const allowedTools = this.buildAllowedTools(request.allowedTools);
    const turnNumber = (this.toolTurnCounters.get(request.actorId) ?? 0) + 1;
    this.toolTurnCounters.set(request.actorId, turnNumber);
    const turnId = `t${turnNumber}`;

    const system = isInitialRound
      ? this.options.promptPolicy.buildSystem(request, { supportsDebugReporting: true })
      : undefined;
    const systemPrompt = this.systemPrompts.get(request.actorId) ?? system!.systemPrompt;
    if (isInitialRound) this.systemPrompts.set(request.actorId, systemPrompt);
    const userPrompt = this.options.promptPolicy.buildUser(request, {
      turnId,
      allowedTools,
      effectiveActionTools: allowedTools.filter((tool) => tool !== PlayerPromptSession.REPORT_BUG_TOOL),
      actionSubmissionHint: [
        "请通过 submit_action 提交游戏行动，",
        `turn_id 必须为 ${turnId}，action 必须是本轮列出的有效行动工具名，arguments 填该行动的参数。`,
        `可先调用 report_bug 上报明确矛盾，其 turn_id 同样必须为 ${turnId}；无需调用 get_game_schema。`,
      ].join(""),
    });
    const currentTurnUser: ChatMessage = { role: "user", content: userPrompt };
    this.append(request.actorId, currentTurnUser);
    return {
      messages: [{ role: "system", content: systemPrompt }, ...contextWindow.history, currentTurnUser],
      systemPrompt,
      userPrompt,
      ...(system?.boardInfoPrompt ? { boardInfoPrompt: system.boardInfoPrompt } : {}),
      ...(system?.configPrompt ? { configPrompt: system.configPrompt } : {}),
      isInitialRound,
      eventCursorBefore: eventDelta.cursorBefore,
      eventCursorAfter: eventDelta.cursorAfter,
      contextWindowStart: contextWindow.start,
      contextWindowEnd: contextWindow.end,
      contextWindowTotal: contextWindow.total,
      turnId,
    };
  }

  appendAssistant(actorId: EntityId, content: string): void {
    this.append(actorId, { role: "assistant", content });
  }

  private append(actorId: EntityId, message: ChatMessage): void {
    const history = this.histories.get(actorId) ?? [];
    history.push(message);
    this.histories.set(actorId, history);
  }

  private ingestVisibleEvents(request: ActionRequest): {
    delta: PlayerVisibleEvent[];
    cursorBefore: number;
    cursorAfter: number;
  } {
    const events = parsePlayerVisibleEvents(request.context.visible_events);
    const cursor = this.eventCursors.get(request.actorId) ?? 0;
    if (!events.length) return { delta: [], cursorBefore: cursor, cursorAfter: cursor };
    const delta = events.filter((event) => event.seq > cursor);
    for (const event of delta) {
      this.append(request.actorId, { role: "user", content: encodePlayerVisibleEvent(event) });
    }
    const nextCursor = events.reduce((max, event) => Math.max(max, event.seq), cursor);
    this.eventCursors.set(request.actorId, nextCursor);
    return { delta, cursorBefore: cursor, cursorAfter: nextCursor };
  }

  private selectHistoryWindow(fullHistory: ChatMessage[]) {
    const total = fullHistory.length;
    const start = Math.max(0, total - Math.max(1, this.options.maxPromptEvents * 6));
    return { start, end: total, total, history: fullHistory.slice(start) };
  }

  private buildAllowedTools(allowedTools: ToolName[]): ToolName[] {
    const tools = [...allowedTools];
    if (this.options.supportsNativeTools && !tools.includes(PlayerPromptSession.REPORT_BUG_TOOL)) {
      tools.push(PlayerPromptSession.REPORT_BUG_TOOL);
    }
    return tools;
  }
}
