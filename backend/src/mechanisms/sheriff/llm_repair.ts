import { ToolRepairPack } from "../llm/contracts";

export const SHERIFF_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    run_for_sheriff: (args) => ({
      run: Boolean(args.run),
    }),
    vote_for_sheriff: (args) => {
      const abstain = Boolean(args.abstain);
      if (abstain) {
        return { target_id: null, abstain: true };
      }
      const targetId = Number(args.target_id);
      if (!Number.isFinite(targetId) || targetId <= 0) {
        return null;
      }
      return { target_id: targetId, abstain: false };
    },
    choose_direction: (args) => {
      const direction = String(args.direction ?? "");
      if (!["clockwise", "counter_clockwise"].includes(direction)) {
        return null;
      }
      return { direction };
    },
  },
  recover: {
    run_for_sheriff: (text) => {
      const lower = text.toLowerCase();
      const run =
        lower.includes("上警") ||
        lower.includes("参选") ||
        lower.includes("竞选") ||
        lower.includes("run");
      return { name: "run_for_sheriff", args: { run } };
    },
    vote_for_sheriff: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes("弃票") || lower.includes("abstain")) {
        return {
          name: "vote_for_sheriff",
          args: { target_id: null, abstain: true },
        };
      }
      const m = text.match(/(\d+)\s*号/);
      const target = m ? Number(m[1]) : 1;
      return {
        name: "vote_for_sheriff",
        args: { target_id: target, abstain: false },
      };
    },
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
