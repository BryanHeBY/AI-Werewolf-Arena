/** 文件说明：守卫原生工具参数纠正规则。 */
import { ToolRepairPack } from "../../llm/contracts";
import { numberOrNull } from "../../llm/helpers";

export const GUARD_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    guard: (args) => {
      const abstain = Boolean(args.abstain);
      if (abstain) return { target_id: null, abstain: true };
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target, abstain: false };
    },
  },
};
