/**
 * 负责从炼金魔女／狼鸦之爪的原角色数据读取既有政策校验后的独立玩家视图。
 * 输入为原角色组件；输出复制历史、目标数组与已知队友，纯 DTO 类型由公共事实契约拥有。
 * 私有库存与知识更新仍归机制，投影不携带 Frame、原生命或租约，不付款、安装资源或授权。
 * Proxy 拒绝和字段描述符读取在原位置执行；本模块不扩大原状态 reader 的接受集合。
 */
import { Role } from "../../../../core/domain/identity";
import { types } from "node:util";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { playerDataField } from "../player_state";
import { MIST_RAVEN_POLICY, readAlchemistState, readRavenState } from "./state";
import type {
  PlayerAlchemistState,
  PlayerRavenState,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";
export function projectAlchemist(
  role: RoleComponent | undefined,
): PlayerAlchemistState | undefined {
  if (types.isProxy(role) || playerDataField(role, "role") !== Role.Alchemist) return;
  const container = playerDataField(role, "privateState");
  if (types.isProxy(container)) return;
  const state = readAlchemistState(playerDataField(container, "alchemist"));
  if (!state) return;
  return {
    policy: MIST_RAVEN_POLICY,
    mistRemaining: state.mistRemaining,
    healRemaining: state.healRemaining,
    mistHistory: state.mistHistory.map((row) => ({
      day: row.day,
      targetIds: row.targetIds === null ? null : [...row.targetIds],
    })),
    healHistory: state.healHistory.map((row) => ({ day: row.day, targetId: row.targetId })),
  };
}
export function projectRaven(role: RoleComponent | undefined): PlayerRavenState | undefined {
  if (types.isProxy(role) || playerDataField(role, "role") !== Role.RavenClawWolf) return;
  const container = playerDataField(role, "privateState");
  if (types.isProxy(container)) return;
  const state = readRavenState(playerDataField(container, "ravenClaw"));
  if (!state) return;
  return {
    policy: MIST_RAVEN_POLICY,
    awakened: state.awakenedDay !== null,
    extraRemaining: state.extraRemaining,
    knownTeammateIds: [...state.knownTeammateIds],
    extraHistory: state.extraHistory.map((row) => ({ day: row.day, targetId: row.targetId })),
  };
}
