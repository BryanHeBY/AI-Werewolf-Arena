/**
 * 持有 SDK 提示会话中每位玩家的追加历史、可见事件游标、回合计数和首次系统提示。
 * 输入为调用方传入的 ActionRequest 与提示政策；输出为历史窗口和本轮提示，记录指标随结果返回。
 * 请求授权与 currentness 仍归请求所有者，此处只解析可见事件并构建文本。
 * 历史只追加，窗口仅影响本次发送；本模块不选择行动、不执行工具，也不改变游戏阶段。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { ActionRequest, EntityId, PlayerVisibleEvent, ToolName } from "../../../domain";
import { encodePlayerVisibleEvent, parsePlayerVisibleEvents } from "../visible_event_protocol";
import { BuiltPlayerPrompt } from "../player/contracts";
import { ChatMessage } from "../../integrations/llm/transport";
import { PlayerPromptPolicy } from "../player/player_prompt_policy";

export interface PlayerPromptSessionOptions {
  maxPromptEvents: number;
  promptPolicy: PlayerPromptPolicy;
}

/** 以玩家编号隔离历史与提示缓存；事件和回合使用各自的计数语义。 */
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
    // 系统提示只在首次构建后缓存；后续请求复用该文本，本轮行动与观察放在 user 提示中。
    const systemPrompt = this.systemPrompts.get(request.actorId) ?? system!.systemPrompt;
    if (isInitialRound) this.systemPrompts.set(request.actorId, systemPrompt);
    const userPrompt = this.options.promptPolicy.buildUser(request, {
      turnId,
      allowedTools,
      effectiveActionTools: allowedTools.filter(
        (tool) => tool !== PlayerPromptSession.REPORT_BUG_TOOL,
      ),
      actionSubmissionHint: text(this.options.promptPolicy.locale, "prompt.sdk.submit", {
        turn: turnId,
      }),
    });
    const currentTurnUser: ChatMessage = { role: "user", content: userPrompt };
    // 先追加本轮提示再返回。后续传输失败不回滚已经推进的历史、游标和回合计数。
    this.append(request.actorId, currentTurnUser);
    return {
      messages: [
        { role: "system", content: systemPrompt },
        ...contextWindow.history,
        currentTurnUser,
      ],
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
    // 只按玩家可见序号去重，保留输入事件顺序；不读取全局事件序号或补齐隐藏缺口。
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
    // 窗口按已存消息条数计算，事件、提示和回应均计入；切片不会删掉完整历史。
    const start = Math.max(0, total - Math.max(1, this.options.maxPromptEvents * 6));
    return { start, end: total, total, history: fullHistory.slice(start) };
  }

  private buildAllowedTools(allowedTools: ToolName[]): ToolName[] {
    const tools = [...allowedTools];
    if (!tools.includes(PlayerPromptSession.REPORT_BUG_TOOL)) {
      tools.push(PlayerPromptSession.REPORT_BUG_TOOL);
    }
    return tools;
  }
}
