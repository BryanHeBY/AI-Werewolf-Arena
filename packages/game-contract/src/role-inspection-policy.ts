/**
 * 负责身份查验的纯数据政策解释：输入为原只读政策字段，输出为角色政策、目标重复或必选判断。
 * 默认映射与政策读取由本模块唯一拥有，保留原缺省、配置优先级、重复 getter 和机器错误码。
 * 不读历史、World、生命、时钟、库存或请求句柄，不授予查验许可，也不渲染产品文案。
 * 政策数据存在不等于窗口有效；状态安装、付款、报告写入与行动前复验仍归具体机制。
 */
import { INSPECTION_POLICIES, type InspectionPolicy } from "./boards";
import type { RoleInspectionReadState, RoleInspectionPolicy } from "./night-ability-data";

export function roleInspectionPolicy(state: RoleInspectionReadState): RoleInspectionPolicy {
  // 保留先校验配置政策、再读取角色政策的顺序；安装入口也依赖这组原错误码。
  if (state.inspectionPolicy !== undefined && !INSPECTION_POLICIES.includes(state.inspectionPolicy))
    throw new Error("role_inspection_configuration_policy_invalid");
  const policy = state.policy === undefined ? "gargoyle" : state.policy;
  if (
    policy !== "gargoyle" &&
    policy !== "psychic" &&
    policy !== "mirror" &&
    policy !== "pure_white" &&
    policy !== "wolf_witch"
  )
    throw new Error("role_inspection_policy_invalid");
  return policy;
}

/** 角色政策到缺省目标政策的映射；显式配置优先，as const 只约束类型，不冻结运行时对象。 */
export const DEFAULT_INSPECTION_POLICIES = {
  gargoyle: "awa_unique_required_v1",
  psychic: "awa_repeat_optional_v1",
  mirror: "awa_unique_optional_v1",
  pure_white: "awa_repeat_optional_v1",
  wolf_witch: "awa_repeat_optional_v1",
} as const;

export function inspectionPolicy(
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
): InspectionPolicy {
  // 显式配置会短路角色政策读取；缺省分支才校验角色政策，不能提前读取或缓存 getter。
  const value =
    state.inspectionPolicy ??
    DEFAULT_INSPECTION_POLICIES[roleInspectionPolicy(state as RoleInspectionReadState)];
  if (!INSPECTION_POLICIES.includes(value))
    throw new Error("role_inspection_configuration_policy_invalid");
  return value;
}

export const inspectionRepeats = (
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
) => inspectionPolicy(state) === "awa_repeat_optional_v1";

export const inspectionRequired = (
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
) => inspectionPolicy(state) === "awa_unique_required_v1";
