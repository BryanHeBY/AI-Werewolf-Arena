/** 文件说明：警长机制原生工具参数纠正规则。 */
import { ToolRepairPack } from "../llm/contracts";

export const SHERIFF_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    run_for_sheriff: (args) => ({ run: Boolean(args.run) }),
    vote_for_sheriff: (args) => {
      const abstain = Boolean(args.abstain);
      if (abstain) return { target_id: null, abstain: true };
      const targetId = Number(args.target_id);
      return Number.isFinite(targetId) && targetId > 0
        ? { target_id: targetId, abstain: false }
        : null;
    },
    choose_direction: (args) => {
      const direction = String(args.direction ?? "");
      return ["clockwise", "counter_clockwise"].includes(direction) ? { direction } : null;
    },
  },
};
