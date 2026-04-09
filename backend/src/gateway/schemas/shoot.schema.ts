
/**
 * 猎人开枪工具 schema：定义开枪目标参数。
 */
export const shootSchema = {
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
