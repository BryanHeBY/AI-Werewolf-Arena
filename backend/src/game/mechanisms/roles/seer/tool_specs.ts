/** 文件说明：预言家工具规格定义。 */
import { ToolSpec } from "../../contracts";
import { prop } from "../../shared/schema";

/** 预言家工具规格列表。 */
export const SEER_TOOL_SPECS: ToolSpec[] = [
  {
    name: "check_identity",
    llm: {
      name: "check_identity",
      description: "预言家查验目标玩家身份阵营。",
      parameters: {
        type: "object",
        properties: {
          target_id: prop("number", "目标玩家编号。"),
        },
        description: "查验参数。",
        required: ["target_id"],
        additionalProperties: false,
      },
    },
    argHint: 'check_identity args: {"target_id":number}',
  },
];
