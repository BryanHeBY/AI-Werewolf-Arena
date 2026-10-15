/**
 * 负责千面人三字段首夜选择槽的创建安装、原 schema／工具读取、玩家投影与数据消费／失败取消。
 * 输入为原角色记录、原状态及调用方已核选择；输出保原槽引用、显示副本和逐字段已写前缀。
 * 选新身份先消费 remaining 再写 choice；失败补偿仅沿原可写 descriptor，不为盗贼扩展这一政策。
 * 此轻数据所有者不拥有物理牌、World 身份或窗口授权，也不增加未知对象零反射异常保证。
 */
import type { ShapeshifterState, ShapeshifterReadState } from "@ai-werewolf-arena/game-contract";
import { Role, type RoleComponent, type World } from "../../../../domain";
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

import type { RoleInitializationComponent } from "../contracts";

/** 原 LHS 私有容器先于 policy 求值；不缓存 config 或改写已存在的合法槽。 */
export function initializeShapeshifterState(role: RoleInitializationComponent, policy: () => ShapeshifterState["policy"]): void {
  if (!getShapeshifterState(role))
    role.privateState.shapeshifter = {
      policy: policy(),
      remaining: 1,
      choice: null,
    };
}

/** 原窗口先复验；此处只有两项数据写，首 setter 失败不会写 choice。 */
export function consumeShapeshifterState(state: Pick<ShapeshifterReadState, "remaining" | "choice">, choice: 0 | 1 | null): void {
  (state as Pick<ShapeshifterState, "remaining">).remaining = 0;
  (state as Pick<ShapeshifterState, "choice">).choice = choice;
}

/** 仅千面人的原 finally 补偿：两 descriptor 都可写才按原次序关闭库存；不新增拒绝或捕获异常。 */
export function cancelShapeshifterState(original: Pick<ShapeshifterReadState, "remaining" | "choice"> | null | undefined): void {
  if (
    original &&
    Object.getOwnPropertyDescriptor(original, "remaining")?.writable &&
    Object.getOwnPropertyDescriptor(original, "choice")?.writable
  ) {
    (original as Pick<ShapeshifterState, "remaining">).remaining = 0;
    (original as Pick<ShapeshifterState, "choice">).choice = null;
  }
}
