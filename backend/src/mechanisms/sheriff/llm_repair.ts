import { ToolRepairPack } from "../llm/contracts";

export const SHERIFF_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    choose_direction: (args) => {
      const direction = String(args.direction ?? "");
      if (!["clockwise", "counter_clockwise"].includes(direction)) {
        return null;
      }
      return { direction };
    },
  },
  recover: {
    choose_direction: (text) => {
      const lower = text.toLowerCase();
      const direction =
        lower.includes("counter_clockwise") ||
        lower.includes("counterclockwise") ||
        lower.includes("逆时针") ||
        lower.includes("警右")
          ? "counter_clockwise"
          : "clockwise";
      return {
        name: "choose_direction",
        args: { direction },
      };
    },
  },
};
