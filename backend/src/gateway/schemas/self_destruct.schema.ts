
/**
 * 狼人自爆工具 schema：定义自爆理由参数。
 */
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
