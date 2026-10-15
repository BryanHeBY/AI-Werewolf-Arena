/**
 * 负责从觉醒隐狼工具名生成传输参数规格。输入为原静态名称数组；输出为工具 schema、
 * 原参数提示和本地化提示键。守护／额外刀允许 null，其余目标为 integer；规格不安装技能或判断当前许可。
 */
import type { MessageKey } from "@ai-werewolf-arena/game-text";
import type { ToolSpec } from "../../engine/actions/tool-contracts";
import { AWAKENED_TOOL_NAMES } from "./tool-names";

export const AWAKENED_TOOL_SPECS: ToolSpec[] = AWAKENED_TOOL_NAMES.map((name) => {
  const nullable = name === "awakened_guard" || name === "awakened_attack";
  return {
    name,
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
