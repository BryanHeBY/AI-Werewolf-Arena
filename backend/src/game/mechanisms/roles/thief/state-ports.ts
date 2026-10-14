/**
 * 负责盗贼首夜选择数据的原接受集合、同引用读取、创建安装、工具解析和玩家知识副本。
 * 输入为原角色／上下文和未知工具数据；输出为原三字段槽、脱离显示或原明确拒绝。
 * 数据所有者不发物理牌、不验证选择窗口或授予身份替换权限；原 descriptor／Proxy 接受宽度不收窄。
 * 玩家 remaining 只按原 setup 状态展示，副本不消费库存；换新身份的盗贼旧对象不在千面人分支付款。
 */
import type { ThiefState, ThiefReadState } from "@ai-werewolf-arena/game-contract";
import { Role, type RoleComponent, type World } from "../../../../core/domain";
import { thiefSetupStatus } from "./deal";
import { dataField } from "../initial_identity/data-ports";
export const THIEF_POLICY = "lui_meme_thief_two_extra_villagers_v1" as const;
/** 只核原角色／三字段状态；成功保同一live引用，不新增camp、写权或不可反射对象要求。 */
export function getThiefState(role: RoleComponent | undefined): ThiefReadState | null {
  if (!role || dataField(role, "role") !== Role.Thief) return null;
  const state = dataField(dataField(role, "privateState"), "thief");
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const keys = Reflect.ownKeys(state);
  if (
    keys.length !== 3 ||
    !keys.every((key) => ["policy", "remaining", "choice"].includes(String(key)))
  )
    return null;
  // 原remaining和choice各自允许0／1，choice还允许null；这里只读字段，选择合法性由原scope继续核。
  const policy = dataField(state, "policy"),
    remaining = dataField(state, "remaining"),
    choice = dataField(state, "choice");
  return policy === THIEF_POLICY &&
    (remaining === 0 || remaining === 1) &&
    (choice === null || choice === 0 || choice === 1)
    ? (state as ThiefReadState)
    : null;
}
/** 新知识对象只调整显示remaining；原状态、policy和choice读取先后不变，副本不是可提交选择。 */
export function projectThiefState(
  role: RoleComponent | undefined,
  world: World,
): ThiefState | undefined {
  const s = getThiefState(role);
  if (!s) return;
  return {
    policy: s.policy,
    remaining: thiefSetupStatus(world) === "pending" ? s.remaining : 0,
    choice: s.choice,
  };
}
/** 只接受原唯一slot自有键及0／1值；descriptor字段读取不调用普通访问器，但反射仍可能失败。 */
export function readThiefChoice(value: unknown): 0 | 1 | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "slot") return;
  const slot = dataField(value, "slot");
  return slot === 0 || slot === 1 ? slot : undefined;
}

/** 先核原两键与工具名，再读取args／slot；首个失败按原null结果或反射异常传播，不补新参数。 */
export function readThiefTool(
  value: unknown,
): import("../../../../core/domain").TypedToolCall<"choose_thief_card"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    !keys.includes("name") ||
    !keys.includes("args") ||
    dataField(value, "name") !== "choose_thief_card"
  )
    return null;
  const slot = readThiefChoice(dataField(value, "args"));
  return slot === undefined ? null : { name: "choose_thief_card", args: { slot } };
}

import type { RoleInitializationComponent } from "../contracts";

/** 原 LHS 私有容器先于 policy 求值；不缓存 config 或改写已存在的合法槽。 */
export function initializeThiefState(role: RoleInitializationComponent, policy: () => ThiefState["policy"]): void {
  if (!getThiefState(role))
    role.privateState.thief = {
      policy: policy(),
      remaining: 1,
      choice: null,
    };
}
