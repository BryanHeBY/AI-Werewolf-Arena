/**
 * 负责 Pi 玩家本轮提示和可见事件游标。完整对话只由 Pi 内存会话持有；这里不保存第二份历史。
 * 结构只含初始提示、逐玩家可见事件游标和回合计数；完整消息列表由 Pi session 独占。
 * 游标只使用逐玩家可见序号，初始化或传输失败后新会话从零接收当前可见事实。
 */
import { text } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "../../domain";
import type { BuiltPlayerPrompt } from "../player/contracts";
import type { PlayerPromptPolicy } from "../player/player-prompt-policy";
import { encodePlayerVisibleEventBatch, parsePlayerVisibleEvents } from "../visible-event-protocol";

export class PiPromptState {
  private cursor = 0;
  private nextTurn = 0;
  private readonly initial;

  constructor(
    private readonly policy: PlayerPromptPolicy,
    request: ActionRequest,
  ) {
    this.initial = policy.buildSystem(request, { supportsDebugReporting: true });
  }

  get systemPrompt(): string {
    return this.initial.systemPrompt;
  }

  build(request: ActionRequest): BuiltPlayerPrompt {
    const events = parsePlayerVisibleEvents(request.context.visible_events);
    const before = this.cursor;
    const delta = events.filter((event) => event.seq > before);
    const after = events.reduce((max, event) => Math.max(max, event.seq), before);
    const turnId = `p${++this.nextTurn}`;
    const user = this.policy.buildUser(request, {
      turnId,
      allowedTools: [...new Set([...request.allowedTools, "report_bug" as const])],
      effectiveActionTools: request.allowedTools,
      actionSubmissionHint: text(this.policy.locale, "prompt.sdk.submit", { turn: turnId }),
    });
    const userPrompt = [delta.length ? encodePlayerVisibleEventBatch(delta) : "", user]
      .filter(Boolean)
      .join("\n");
    // 追加输入的尝试已发生即推进游标；失败会退役此会话，不把旧游标移交给新实例。
    this.cursor = after;
    return {
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      systemPrompt: this.systemPrompt,
      userPrompt,
      boardInfoPrompt: this.initial.boardInfoPrompt,
      configPrompt: this.initial.configPrompt,
      isInitialRound: this.nextTurn === 1,
      eventCursorBefore: before,
      eventCursorAfter: after,
      contextWindowStart: 0,
      contextWindowEnd: 0,
      contextWindowTotal: 0,
      turnId,
      auditMetadata: [
        `transport=pi;turn_id=${turnId};event_cursor=${before}->${after};history_owner=pi`,
      ],
    };
  }
}
