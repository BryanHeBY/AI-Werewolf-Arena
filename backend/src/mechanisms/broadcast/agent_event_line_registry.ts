/** 文件说明：将领域事件转换为“单个玩家可见”的广播行。 */
import { GameEvent } from "../../domain/model";
import { GUARD_AGENT_EVENT_LINE_HANDLERS } from "../roles/guard/event_presenters";
import { HUNTER_AGENT_EVENT_LINE_HANDLERS } from "../roles/hunter/event_presenters";
import { SEER_AGENT_EVENT_LINE_HANDLERS } from "../roles/seer/event_presenters";
import { WITCH_AGENT_EVENT_LINE_HANDLERS } from "../roles/witch/event_presenters";
import { WOLF_AGENT_EVENT_LINE_HANDLERS } from "../roles/wolf/event_presenters";
import { LAST_WORDS_AGENT_EVENT_LINE_HANDLERS } from "../last_words/event_presenters";
import { SHERIFF_AGENT_EVENT_LINE_HANDLERS } from "../sheriff/event_presenters";
import { IDIOT_AGENT_EVENT_LINE_HANDLERS } from "../roles/idiot/event_presenters";
import { AgentEventLineHandler, AgentLineContext } from "./contracts";

const DEFAULT_HANDLERS: Record<string, AgentEventLineHandler> = {
  phase_changed: (event) => {
    const p = event.payload as Record<string, any>;
    if (p.phase === "day") {
      return `[系统][公开] 天亮了（第${p.day}天白天）`;
    }
    if (p.phase === "voting") {
      return `[系统][公开] 现在进入放逐投票阶段`;
    }
    if (p.phase === "night") {
      return `[系统][公开] 天黑请闭眼（第${p.day}天夜晚）`;
    }
    if (p.phase === "game_over") {
      return `[系统][公开] 对局结束`;
    }
    return null;
  },
  day_speech: (event) => {
    const p = event.payload as Record<string, any>;
    return `[发言][公开][${p.actorId}] ${p.text}`;
  },
  night_resolved: (event) => {
    const p = event.payload as Record<string, any>;
    if (Array.isArray(p.deaths) && p.deaths.length > 0) {
      return `[系统][公开] 昨夜死亡：${p.deaths.join("、")}号`;
    }
    return `[系统][公开] 昨夜平安夜`;
  },
  voted_out: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] 放逐结果：${p.target}号出局`;
  },
  game_over: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] 胜利阵营：${p.winner}，原因：${p.reason}`;
  },
  ...WOLF_AGENT_EVENT_LINE_HANDLERS,
  ...SEER_AGENT_EVENT_LINE_HANDLERS,
  ...GUARD_AGENT_EVENT_LINE_HANDLERS,
  ...HUNTER_AGENT_EVENT_LINE_HANDLERS,
  ...WITCH_AGENT_EVENT_LINE_HANDLERS,
  ...IDIOT_AGENT_EVENT_LINE_HANDLERS,
  ...LAST_WORDS_AGENT_EVENT_LINE_HANDLERS,
  ...SHERIFF_AGENT_EVENT_LINE_HANDLERS,
};

/** 玩家广播文本行注册表。 */
export class AgentEventLineRegistry {
  private readonly handlers: Record<string, AgentEventLineHandler>;

  constructor(handlers: Record<string, AgentEventLineHandler> = DEFAULT_HANDLERS) {
    this.handlers = { ...handlers };
  }

  toLine(event: GameEvent, ctx: AgentLineContext): string | null {
    const handler = this.handlers[event.type];
    if (!handler) {
      return null;
    }
    return handler(event, ctx);
  }
}

let defaultRegistry: AgentEventLineRegistry | null = null;

/** 获取默认玩家广播文本行注册表实例。 */
export function getDefaultAgentEventLineRegistry(): AgentEventLineRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new AgentEventLineRegistry();
  }
  return defaultRegistry;
}
