/** 文件说明：预言家工具规格定义。 */
import { ToolSpec } from "../../contracts";

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
