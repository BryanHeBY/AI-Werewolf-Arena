/** Legacy contributor export; camp/reason terms have one shared owner. */
import { term } from "@ai-werewolf-arena/game-text";
import type { TextLocalizationContributor } from "../shared/text_localization_registry";
export const WIN_CONDITION_TEXT_LOCALIZATION_CONTRIBUTOR: TextLocalizationContributor = {
  winnerNames: Object.fromEntries(
    ["wolf", "good", "third_party"].map((camp) => [camp, term("camp", camp)]),
  ),
  gameOverReasons: Object.fromEntries(
    [
      "all_wolves_eliminated",
      "all_good_eliminated",
      "slaughter_side_completed",
      "wolves_reach_half",
    ].map((reason) => [reason, term("reason", reason)]),
  ),
};
