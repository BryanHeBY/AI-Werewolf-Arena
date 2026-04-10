
/**
 * 守卫工具 schema：约束守卫夜间守护目标参数。
 */
export const guardSchema = {
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
