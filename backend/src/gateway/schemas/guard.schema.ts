export const guardSchema = {
  name: "guard",
  description: "守卫目标，不能连续两晚守同一人",
  parameters: {
    type: "object",
    properties: {
      target_id: { type: "number" },
    },
    required: ["target_id"],
  },
} as const;
