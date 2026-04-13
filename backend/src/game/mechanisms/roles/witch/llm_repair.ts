/** 文件说明：女巫工具调用的 LLM 修复策略。 */
import { PotionType } from "../../../domain/model";
import { ToolRepairPack } from "../../llm/contracts";
import {
  extractPotion,
  extractTargetId,
  numberOrNull,
  pickAliveNotSelf,
} from "../../llm/helpers";

/** 女巫角色 LLM 修复包。 */
export const WITCH_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    use_potion: (args) => {
      const target = numberOrNull(args.target_id);
      if (target === null) {
        return null;
      }
      if (
        ![PotionType.Heal, PotionType.Poison, PotionType.None].includes(
          args.potion_type as PotionType,
        )
      ) {
        return null;
      }
      return {
        target_id: target,
        potion_type: args.potion_type,
      };
    },
  },
  recover: {
    use_potion: (text, ctx) => {
      const targetId = extractTargetId(text, ctx.actorId);
      const fallbackTarget = pickAliveNotSelf(ctx.world, ctx.actorId);
      return {
        name: "use_potion",
        args: {
          target_id: targetId ?? fallbackTarget ?? ctx.actorId,
          potion_type: extractPotion(text),
        },
      };
    },
  },
};
