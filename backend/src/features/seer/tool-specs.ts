/**
 * 负责声明预言家查验工具的传输 schema 与参数提示。输入为 target_id 规格；输出为原可写规格数组。
 * 原 schema 只要求 number，不在此加强为安全整数或当前活人；实际目标与实例权限仍由 gateway／领域校验。
 */
import { ToolSpec } from "../../engine/actions/tool-contracts";

/** 预言家工具规格列表。 */
export const SEER_TOOL_SPECS: ToolSpec[] = [
  {
    name: "check_identity",
    parameters: {
      type: "object",
      properties: {
        target_id: { type: "number" },
      },
      required: ["target_id"],
      additionalProperties: false,
    },
    argHint: 'check_identity args: {"target_id":number}',
  },
];
