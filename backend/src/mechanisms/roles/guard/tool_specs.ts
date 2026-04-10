import { ToolSpec } from "../../contracts";
import { prop } from "../../shared/schema";

const guardSchema = {
  name: "guard",
  description: "守卫目标；abstain=true 表示本轮空守",
  parameters: {
    type: "object",
    properties: {
      target_id: { type: ["number", "null"] },
      abstain: { type: "boolean" },
    },
    required: ["target_id", "abstain"],
  },
} as const;

export const GUARD_TOOL_SPECS: ToolSpec[] = [
  {
    name: "guard",
    llm: {
      name: "guard",
      description: "守卫守护目标。abstain=true 表示本轮空守。",
      parameters: {
        type: "object",
        properties: {
          target_id: prop(["number", "null"], "守护目标玩家编号；空守时必须为 null。"),
          abstain: prop("boolean", "是否空守；true 时本轮不守护任何玩家。"),
        },
        description: "守卫行动参数。",
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
    },
    argHint: 'guard args: {"target_id":number|null,"abstain":true|false}',
    gatewaySchema: guardSchema,
  },
];
