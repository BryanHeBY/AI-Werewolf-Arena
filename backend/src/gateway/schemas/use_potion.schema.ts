export const usePotionSchema = {
  name: "use_potion",
  description: "女巫使用解药或毒药，不能同夜双药，MVP 不可自救",
  parameters: {
    type: "object",
    properties: {
      target_id: { type: "number" },
      potion_type: { type: "string", enum: ["heal", "poison", "none"] },
    },
    required: ["target_id", "potion_type"],
  },
} as const;
