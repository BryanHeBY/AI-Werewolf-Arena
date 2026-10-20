/**
 * 负责从机械狼工具名生成传输规格。输入为原静态名称数组；输出为原模式／目标 schema、提示和语言键。
 * 模式只取 kill／skill，守护与额外刀允许 null；规格可写不等于获权，完整当前规则由回合提示和领域校验给出。
 */
import type { MessageKey } from "@ai-werewolf-arena/game-text";
import type { ToolSpec } from "../../engine/actions/tool-contracts";
import { MECHANICAL_TOOL_NAMES } from "./tool-names";

/** 传输描述保持中立；完整本地化规则由当前回合提示提供，规格不授予执行许可。 */
export const MECHANICAL_TOOL_SPECS: ToolSpec[] = MECHANICAL_TOOL_NAMES.map((name) => {
  const parameters =
    name === "mechanical_mode"
      ? {
          type: "object",
          properties: { mode: { type: "string", enum: ["kill", "skill"] } },
          required: ["mode"],
          additionalProperties: false,
        }
      : {
          type: "object",
          properties: {
            target_id: {
              type:
                name === "mechanical_guard" || name === "mechanical_attack"
                  ? ["integer", "null"]
                  : "integer",
            },
          },
          required: ["target_id"],
          additionalProperties: false,
        };
  return {
    name,
    parameters: parameters,
    argHint:
      name === "mechanical_mode"
        ? 'mechanical_mode args: {"mode":"kill"|"skill"}'
        : `${name} args: {"target_id":number${name === "mechanical_guard" || name === "mechanical_attack" ? "|null" : ""}}`,
    userPromptHintKey: `action.${name}.hint` as MessageKey,
  };
});
