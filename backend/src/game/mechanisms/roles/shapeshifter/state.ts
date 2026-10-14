/**
 * 负责读取千面人私有状态结构并构造玩家投影，private 槽仍由原角色／初始化 owner 持有。
 * 输入为角色记录，投影另接收 World；输出为合法原槽引用或新 policy／remaining／choice
 * 视图。只在 setup 为 pending 时展示存储 remaining，其他 setup 状态投影为 0，不改 live 库存。
 * 具名工具出口引用同一 shared reader；本模块不发牌或提交身份替换，也不新增未知对象零 trap 保证。
 */
import type { ShapeshifterState, ShapeshifterReadState } from "@ai-werewolf-arena/game-contract";
import { Role, type RoleComponent, type World } from "../../../../core/domain";
import { shapeshifterSetupStatus } from "./deal";
export const SHAPESHIFTER_POLICY = "awa_netease_shapeshifter_two_extra_villagers_v1" as const;
import { dataField } from "../initial_identity/data-ports";
export function getShapeshifterState(
  role: RoleComponent | undefined,
): ShapeshifterReadState | null {
  if (!role || dataField(role, "role") !== Role.Shapeshifter) return null;
  const state = dataField(dataField(role, "privateState"), "shapeshifter");
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const keys = Reflect.ownKeys(state);
  if (
    keys.length !== 3 ||
    !keys.every((key) => ["policy", "remaining", "choice"].includes(String(key)))
  )
    return null;
  const policy = dataField(state, "policy"),
    remaining = dataField(state, "remaining"),
    choice = dataField(state, "choice");
  return policy === SHAPESHIFTER_POLICY &&
    (remaining === 0 || remaining === 1) &&
    (choice === null || choice === 0 || choice === 1)
    ? (state as ShapeshifterReadState)
    : null;
}
export function projectShapeshifterState(
  role: RoleComponent | undefined,
  world: World,
): ShapeshifterState | undefined {
  const s = getShapeshifterState(role);
  if (!s) return;
  return {
    policy: s.policy,
    remaining: shapeshifterSetupStatus(world) === "pending" ? s.remaining : 0,
    choice: s.choice,
  };
}
export function readShapeshifterChoice(value: unknown): 0 | 1 | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "slot") return;
  const slot = dataField(value, "slot");
  return slot === 0 || slot === 1 ? slot : undefined;
}

export { readShapeshifterChoiceTool as readShapeshifterTool } from "@ai-werewolf-arena/game-contract/facts/shapeshifter";
