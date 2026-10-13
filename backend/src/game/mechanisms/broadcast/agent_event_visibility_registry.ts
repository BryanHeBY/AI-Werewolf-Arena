/**
 * 负责适配既有 Agent 布尔可见性入口和显式自定义规则。输入为原 World、typed GameEvent 与玩家编号；
 * 输出保持原家族受众政策。默认家族读取归共用 owner，Node hostile ingress 仍归事件流入口；此公开入口不新增 unknown 零 trap 承诺。
 * 在原恶魔分支才读取 actor 身份；在原自定义分支才取规则并调用原 receiver 与参数。
 * 历史 audience 不随当前阵营补发或撤回；这里不裁剪第二份副本、不付款，也不授予行动写权限。
 */
import type { EntityId, GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../core/domain/world";
import { demonHunterActorId } from "../roles/demon_hunter/authority";
import {
  canViewAgentEvent,
  canViewPreparedAgentEvent,
} from "../../observation/agent-event-projection";
import type { PreparedAgentEvent } from "../../observation/agent-event-facts";

type AgentEventVisibilityRule = (world: World, event: GameEvent, actorId: EntityId) => boolean;
const DEFAULT_RULES: Record<string, AgentEventVisibilityRule> = {};

/** 默认未知事件不可见；自定义规则是已有显式 trusted 扩展，并非新玩家权限。 */
export class AgentEventVisibilityRegistry {
  constructor(private readonly rules: Record<string, AgentEventVisibilityRule> = DEFAULT_RULES) {}

  canView(world: World, event: GameEvent, actorId: EntityId): boolean {
    return canViewAgentEvent(event, actorId, {
      demonHunterActorId() {
        return demonHunterActorId(world);
      },
      custom: (event, actorId) => {
        const custom = this.rules[event.type];
        if (custom) return { handled: true, visible: custom(world, event, actorId) };
        return { handled: false };
      },
    });
  }

  /** 只消费已经解析的 Node 副本；自定义规则仍收到原副本而不是另一个字段对象。 */
  canViewPrepared(world: World, prepared: PreparedAgentEvent, actorId: EntityId): boolean {
    return canViewPreparedAgentEvent(prepared, actorId, {
      demonHunterActorId() {
        return demonHunterActorId(world);
      },
      custom: (event, actorId) => {
        // schema 规则按同一次快照的类型查找；可信回调仍收到原 source 副本。
        const custom = this.rules[prepared.projectionEvent.type];
        if (custom) return { handled: true, visible: custom(world, event, actorId) };
        return { handled: false };
      },
    });
  }
}

let defaultRegistry: AgentEventVisibilityRegistry | null = null;

export function getDefaultAgentEventVisibilityRegistry(): AgentEventVisibilityRegistry {
  if (!defaultRegistry) defaultRegistry = new AgentEventVisibilityRegistry();
  return defaultRegistry;
}
