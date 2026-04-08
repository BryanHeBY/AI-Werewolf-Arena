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
