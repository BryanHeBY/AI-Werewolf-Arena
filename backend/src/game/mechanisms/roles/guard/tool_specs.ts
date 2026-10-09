/** 文件说明：守卫工具规格定义。 */
import { ToolSpec } from "../../contracts";

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
