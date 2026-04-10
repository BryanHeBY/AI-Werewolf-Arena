import { ToolSpec } from "../../contracts";
import { prop } from "../../shared/schema";

const shootSchema = {
  name: "shoot",
  description: "猎人开枪带走目标",
  parameters: {
    type: "object",
    properties: {
      target_id: { type: "number" },
    },
    required: ["target_id"],
  },
} as const;

export const HUNTER_TOOL_SPECS: ToolSpec[] = [
  {
    name: "shoot",
    llm: {
      name: "shoot",
      description: "猎人开枪指定目标玩家。",
      parameters: {
        type: "object",
        properties: {
          target_id: prop("number", "目标玩家编号。"),
        },
        description: "开枪参数。",
        required: ["target_id"],
        additionalProperties: false,
      },
    },
    argHint: 'shoot args: {"target_id":number}',
    gatewaySchema: shootSchema,
  },
];
