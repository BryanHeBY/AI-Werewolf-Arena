/** 文件说明：猎人原生工具参数纠正规则。 */
import { ToolRepairPack } from "../../llm/contracts";
import { numberOrNull } from "../../llm/helpers";

export const HUNTER_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    shoot: (args) => {
      const target = numberOrNull(args.target_id);
      return target === null ? null : { target_id: target };
    },
  },
};
