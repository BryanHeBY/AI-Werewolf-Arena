/** 文件说明：预言家原生工具参数纠正规则。 */
import { ToolRepairPack } from "../../llm/contracts";
import { numberOrNull } from "../../llm/helpers";

export const SEER_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    check_identity: (args) => {
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target };
    },
  },
};
