/** 文件说明：女巫原生工具参数纠正规则。 */
import { PotionType } from "../../../../core/domain/model";
import { ToolRepairPack } from "../../llm/contracts";
import { numberOrNull } from "../../llm/helpers";

export const WITCH_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    use_potion: (args) => {
      const target = numberOrNull(args.target_id);
      if (target === null || ![PotionType.Heal, PotionType.Poison, PotionType.None].includes(args.potion_type as PotionType)) {
        return null;
      }
      return { target_id: target, potion_type: args.potion_type };
    },
  },
};
