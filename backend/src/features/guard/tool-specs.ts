/**
 * 负责声明守卫工具的传输 schema 与参数提示。输入为 target_id／abstain 规格；输出为原可写规格数组。
 * 目标仍为 number 或 null，schema 不替代目标合法性／连续守护规则；本文件不登记保护或消耗库存。
 */
import { ToolSpec } from "../../engine/actions/tool-contracts";

/** 守卫工具规格列表。 */
export const GUARD_TOOL_SPECS: ToolSpec[] = [
  {
    name: "guard",
    parameters: {
      type: "object",
      properties: {
        target_id: { type: ["number", "null"] },
        abstain: { type: "boolean" },
      },
      required: ["target_id", "abstain"],
      additionalProperties: false,
    },
    argHint: 'guard args: {"target_id":number|null,"abstain":true|false}',
  },
];
