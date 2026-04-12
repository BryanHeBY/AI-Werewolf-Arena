/** 文件说明：胜负判定相关中文文案翻译配置。 */
import type { TextLocalizationContributor } from "../shared/text_localization_registry";

/** 终局文案翻译贡献。 */
export const WIN_CONDITION_TEXT_LOCALIZATION_CONTRIBUTOR: TextLocalizationContributor = {
  winnerNames: {
    wolf: "狼人",
    good: "好人",
    third_party: "第三方",
  },
  gameOverReasons: {
    all_wolves_eliminated: "狼人全部出局",
    all_good_eliminated: "好人全部出局",
    slaughter_side_completed: "屠边条件达成",
    wolves_reach_half: "狼人达半",
  },
};
