import { EntityId, GameEvent } from "../../domain/model";

export interface AgentLineContext {
  actorId: EntityId;
  isWolf: boolean;
}

type AgentEventLineHandler = (event: GameEvent, ctx: AgentLineContext) => string | null;

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
  wolf_self_destruct: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] ${p.wolfId}号狼人自爆`;
  },
  game_over: (event) => {
    const p = event.payload as Record<string, any>;
    return `[系统][公开] 胜利阵营：${p.winner}，原因：${p.reason}`;
  },
  wolf_discussion: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    return `[夜聊][狼队][${p.actorId}] ${p.text}`;
  },
  wolf_discussion_ended: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    return `[夜聊][结束][狼队][${p.actorId}] ${p.reason ?? "未提供原因"}`;
  },
  wolf_tactical_order: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    return `[狼队][顺序] ${Array.isArray(p.order) ? p.order.join("->") : ""}`;
  },
  wolf_kill_vote_cast: (event, ctx) => {
    if (!ctx.isWolf) {
      return null;
    }
    const p = event.payload as Record<string, any>;
    if (p.abstain === true) {
      return `[狼刀票][狼队] ${p.actorId}号 -> 弃刀`;
    }
    return `[狼刀票][狼队] ${p.actorId}号 -> ${p.targetId}号`;
  },
  seer_checked: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[私有][查验] 你查验${p.targetId}号 => ${p.isWerewolf ? "狼人" : "好人"}`;
  },
  guard_applied: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[私有][守卫] 你守护了${p.targetId}号`;
  },
  witch_potion_used: (event, ctx) => {
    const p = event.payload as Record<string, any>;
    if (Number(p.actorId) !== ctx.actorId) {
      return null;
    }
    return `[私有][女巫] 你对${p.targetId}号使用了${p.potionType}`;
  },
};

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

export function getDefaultAgentEventLineRegistry(): AgentEventLineRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new AgentEventLineRegistry();
  }
  return defaultRegistry;
}
