/**
 * 负责身份查验的配置政策默认值、原配置 schema 与政策文案。输入为实例只读政策字段、
 * 板子配置和语言；输出为重复／必选判断、已解析配置及翻译标签。实例政策读取归完整
 * 状态槽；配置查询不写 live payload、不安装库存或授予行动权限。
 */
import { roleInspectionPolicy } from "./state-slot";
import type { RoleInspectionReadState } from "@ai-werewolf-arena/game-contract";

import { z } from "zod";
import {
  INSPECTION_POLICIES,
  type BoardConfig,
  type InspectionPolicy,
} from "../../../../core/domain/board";

import type { RoleProfile } from "../contracts";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

export const DEFAULT_INSPECTION_POLICIES = {
  gargoyle: "awa_unique_required_v1",
  psychic: "awa_repeat_optional_v1",
  mirror: "awa_unique_optional_v1",
  pure_white: "awa_repeat_optional_v1",
  wolf_witch: "awa_repeat_optional_v1",
} as const;
/** 实例身份控制调度；配置的目标／行动政策不改变它，也不能据此新授实例。 */
export function inspectionPolicy(
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
): InspectionPolicy {
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
export function renderInspectionPolicy(
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
  locale: Locale,
): string {
  return text(
    locale,
    inspectionPolicy(state) === "awa_repeat_optional_v1"
      ? "role.inspection.repeat_optional"
      : inspectionPolicy(state) === "awa_unique_required_v1"
        ? "role.inspection.unique_required"
        : "role.inspection.unique_optional",
  );
}
export function inspectionConfiguration(
  key: "gargoyle" | "psychic" | "mirrorGirl",
  defaultValue: InspectionPolicy,
): NonNullable<RoleProfile["configuration"]> {
  const schema = z.strictObject({
    inspectionPolicy: z.enum(INSPECTION_POLICIES).default(defaultValue),
  });
  return {
    schema,
    defaults: schema.parse({}),
    apply: (config, value) => ({ ...config, [key]: schema.parse(value) }),
    serialize: (config: BoardConfig) => schema.parse(config[key] ?? {}),
  };
}
