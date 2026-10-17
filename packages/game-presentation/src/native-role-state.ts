/**
 * 负责内建角色的纯展示片段格式化。输入为纯数据展示片段与当前语言，输出保持原文字、
 * 参数校验、空值和策略分支。调用者在原读取点逐片段提交；本模块不查询 World、
 * 角色库存、请求或真实阵营，不解析私有状态、不授权或提交动作。用户自定义原文不经此入口。
 * 具名便捷格式化器只消费契约字段，保留字段／格式化的逐次顺序；不提前遍历或冻结调用者已选中的政策／报告。
 */
import type {
  NativeRolePresentationPart,
  InspectionResult,
  NativeRoleMessageKey,
  NativeRoleMessageParameters,
  NativeRoleMessagePart,
  RoleInspectionReadState,
} from "@ai-werewolf-arena/game-contract";
import { inspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import { text, roleName, term } from "@ai-werewolf-arena/game-text";
export function formatNativeRolePart(
  part: NativeRolePresentationPart,
  locale: Locale = "zh-CN",
): string {
  if (part.kind === "role-label") return roleName(part.role, locale);
  if (part.kind === "camp-label") return term("camp", part.camp, locale);
  if (part.kind === "death-policy")
    return text(
      locale,
      part.policy === "awa_day_deaths_v1"
        ? "role.death_action.day_deaths"
        : part.policy === "awa_knife_or_exile_v1"
          ? "role.death_action.knife_exile"
          : "role.death_action.qualified",
    );
  return text(locale, part.key, part.parameters);
}

/** 只把原参数对象传给纯格式化器；不在它之前读取后续角色字段。 */
export function formatNativeRoleMessage<K extends NativeRoleMessageKey>(
  locale: Locale,
  key: K,
  ...args: NativeRoleMessageParameters[K] extends undefined ? [] : [NativeRoleMessageParameters[K]]
): string {
  // 泛型 key／参数关联由上面的有限契约检查；运行时仍用原文字校验规则拒绝缺失参数。
  return formatNativeRolePart(
    { kind: "message", key, parameters: args[0] } as NativeRoleMessagePart,
    locale,
  );
}

export function formatNativeRoleName(role: string, locale: Locale): string {
  return formatNativeRolePart({ kind: "role-label", role }, locale);
}

export function formatNativeRoleTerm(_kind: "camp", camp: string, locale: Locale): string {
  return formatNativeRolePart({ kind: "camp-label", camp }, locale);
}

export function formatNativeDeathPolicy(policy: string | undefined, locale: Locale): string {
  return formatNativeRolePart({ kind: "death-policy", policy }, locale);
}

/** 保留原查验结果字段的逐次读取和格式化顺序；展示包不接 live result 句柄。 */
export function formatNativeInspectionLabel(result: InspectionResult, locale: Locale): string {
  if (result.kind === "camp") return formatNativeRoleTerm("camp", result.camp, locale);
  if (result.kind === "role") return formatNativeRoleName(result.role, locale);
  return formatNativeRoleMessage(locale, "inspection.combined", {
    role: formatNativeRoleName(result.role, locale),
    camp: formatNativeRoleTerm("camp", result.camp, locale),
  });
}

export function formatNativeInspectionPolicy(
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
  locale: Locale,
): string {
  return formatNativeRoleMessage(
    locale,
    inspectionPolicy(state) === "awa_repeat_optional_v1"
      ? "role.inspection.repeat_optional"
      : inspectionPolicy(state) === "awa_unique_required_v1"
        ? "role.inspection.unique_required"
        : "role.inspection.unique_optional",
  );
}
