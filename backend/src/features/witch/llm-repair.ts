/**
 * 负责女巫工具参数的原修复规则。输入为原 args；输出为规范目标／瓶型对象或 null。
 * 先经 numberOrNull 读并转换目标，再核瓶型；转换可能执行 caller coercion 或抛错。
 * 修复成功不等于动作接受，不查询库存、刀口、当前请求或付款。
 */
import { PotionType } from "../../domain/model";
import { ToolRepairPack } from "../../agents/tool-repair/contracts";
import { numberOrNull } from "../../agents/tool-repair/helpers";

export const WITCH_LLM_REPAIR_PACK: ToolRepairPack = {
  coerce: {
    use_potion: (args) => {
      // 目标先转换；即使后面瓶型无效，先前getter／转换错误仍按原顺序传播。
      const target = numberOrNull(args.target_id);
      if (
        target === null ||
        ![PotionType.Heal, PotionType.Poison, PotionType.None].includes(
          args.potion_type as PotionType,
        )
      ) {
        return null;
      }
      return { target_id: target, potion_type: args.potion_type };
    },
  },
};
