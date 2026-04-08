export const selfDestructSchema = {
  name: "self_destruct",
  description: "狼人白天自爆，中断流程并跳夜",
  parameters: {
    type: "object",
    properties: {
      reason: { type: "string" },
    },
    required: ["reason"],
  },
} as const;
