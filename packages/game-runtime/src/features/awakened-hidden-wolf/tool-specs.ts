/**
 * 负责从觉醒隐狼工具名生成传输参数规格。输入为原静态名称数组；输出为工具 schema、
 * 原参数提示和本地化提示键。守护／额外刀允许 null，其余目标为 integer；规格不安装技能或判断当前许可。
 */
import type { MessageKey } from "@ai-werewolf-arena/game-text";
import type { ToolSpec } from "../../engine/actions/tool-contracts";
import { AWAKENED_TOOL_NAMES } from "./tool-names";

const feedback = {
  awakened_mimic: { kind: "resolved", events: ["awakened_mimicked"] },
  awakened_poison: { kind: "committed", events: ["awakened_poison_used"] },
  awakened_guard: { kind: "committed", events: ["awakened_guard_chosen"] },
  awakened_attack: { kind: "committed", events: ["awakened_attack_chosen"] },
} satisfies Partial<Record<string, NonNullable<ToolSpec["executionFeedback"]>>>;

export const AWAKENED_TOOL_SPECS: ToolSpec[] = AWAKENED_TOOL_NAMES.map((name) => {
  const nullable = name === "awakened_guard" || name === "awakened_attack";
  return {
    name,
    executionFeedback: feedback[name],
    parameters: {
      type: "object",
      properties: { target_id: { type: nullable ? ["integer", "null"] : "integer" } },
      required: ["target_id"],
      additionalProperties: false,
    },
    argHint: `${name} args: {"target_id":number${nullable ? "|null" : ""}}`,
    userPromptHintKey: `action.${name}.hint` as MessageKey,
  };
});
