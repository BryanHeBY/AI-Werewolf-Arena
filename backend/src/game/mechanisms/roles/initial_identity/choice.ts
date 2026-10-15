/**
 * 负责盗贼／千面人共有选择数据、原工具分派和两张牌的有限选择规则。
 * 输入为原kind／状态／角色与候选牌；输出同引用查询、原工具结果或共同保留身份的两字段写前缀。
 * 千面人换新身份先付款及失败补偿归其轻数据槽；盗贼换新身份原不消耗旧槽，保留分支不额外读取kind。
 * 此组合不发牌、不查询World或验证许可，不因数据写入保证身份安装成功或回滚失败。
 */
import { Role, type RoleComponent, type ToolCall } from "../../../../domain";
import { getThiefState, readThiefTool } from "../thief/state-ports";
import { getShapeshifterState, readShapeshifterTool } from "../shapeshifter/state-ports";
import {
  INITIAL_IDENTITY_POLICIES,
  type InitialIdentityKind,
  type InitialIdentitySlot,
} from "./deal";
export type InitialIdentityState =
  | NonNullable<ReturnType<typeof getThiefState>>
  | NonNullable<ReturnType<typeof getShapeshifterState>>;
export const initialIdentityPolicy = (kind: InitialIdentityKind) => INITIAL_IDENTITY_POLICIES[kind];
export const initialIdentityRole = (kind: InitialIdentityKind) =>
  kind === "thief" ? Role.Thief : Role.Shapeshifter;
export const initialIdentityTool = (kind: InitialIdentityKind) =>
  kind === "thief" ? ("choose_thief_card" as const) : ("choose_shapeshifter_card" as const);
export const getInitialIdentityState = (
  role: RoleComponent | undefined,
  kind: InitialIdentityKind,
): InitialIdentityState | null =>
  kind === "thief" ? getThiefState(role) : getShapeshifterState(role);
export const readInitialIdentityTool = (call: ToolCall, kind: InitialIdentityKind) =>
  kind === "thief" ? readThiefTool(call) : readShapeshifterTool(call);
export function initialIdentityChoiceRule(
  kind: InitialIdentityKind,
  roles: readonly Role[],
): { mustChoose: boolean; allowedSlots: readonly InitialIdentitySlot[] } {
  const wolfSlots = roles.flatMap((role, slot) =>
    role === Role.Wolf ? [slot as InitialIdentitySlot] : [],
  );
  return Object.freeze({
    mustChoose: kind === "shapeshifter" || wolfSlots.length === 2,
    allowedSlots: Object.freeze(
      kind === "shapeshifter" && wolfSlots.length ? wolfSlots : ([0, 1] as InitialIdentitySlot[]),
    ),
  });
}

/** 原保留身份分支只顺序写remaining／choice；不增加kind getter，首setter失败保原部分提交。 */
export function consumeRetainedInitialIdentityState(state: InitialIdentityState): void {
  (state as Pick<import("@ai-werewolf-arena/game-contract").ThiefState | import("@ai-werewolf-arena/game-contract").ShapeshifterState, "remaining">).remaining = 0;
  (state as Pick<import("@ai-werewolf-arena/game-contract").ThiefState | import("@ai-werewolf-arena/game-contract").ShapeshifterState, "choice">).choice = null;
}
