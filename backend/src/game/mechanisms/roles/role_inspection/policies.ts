/**
 * 负责身份查验的原配置 schema 与政策文案。输入为实例只读政策字段、板子配置和语言；
 * 输出为已解析配置及翻译标签，默认解释、重复／必选纯查询归公共契约。
 * 配置与文案不写 live payload、不安装库存或授予行动权限，实际提交仍由机制复验。
 */
import { inspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import type { RoleInspectionReadState } from "@ai-werewolf-arena/game-contract";

import { z } from "zod";
import {
  INSPECTION_POLICIES,
  type BoardConfig,
  type InspectionPolicy,
} from "../../../../core/domain/board";

import type { RoleProfile } from "../contracts";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

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
