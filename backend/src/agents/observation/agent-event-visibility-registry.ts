/**
 * 负责适配既有 Agent 布尔可见性入口和显式自定义规则。输入为原 World、typed GameEvent 与玩家编号；
 * 输出为既有家族受众政策的布尔结果，不返回库存、请求许可或玩家字段投影。
 * 事件流授权消费 prepare 的一次家族事实，独立旧布尔入口仍按原时点读取 trusted 输入。
 * Node hostile ingress 仍归事件流入口；本模块不新增 unknown 零 trap 承诺。
 * 在原恶魔分支才读取 actor 身份；在原自定义分支才取规则并调用原 receiver 与参数。
 * 历史 audience 不随当前阵营补发或撤回；这里不裁剪第二份副本、不付款，也不授予行动写权限。
 */
import type { EntityId, GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../domain/world";
import { demonHunterActorId } from "../../features/demon-hunter/authority";
import {
  canViewAgentEvent,
  canViewPreparedAgentEvent,
} from "./agent-event-projection";
import type { PreparedAgentEvent } from "./agent-event-facts";

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
