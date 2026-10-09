/** Legacy contributor export; no independent potion dictionary. */
import { term, text } from "@ai-werewolf-arena/game-text";
import type { TextLocalizationContributor } from "../../shared/text_localization_registry";
export const WITCH_TEXT_LOCALIZATION_CONTRIBUTOR: TextLocalizationContributor = {
  potionTypes: {
    heal: term("potion", "heal"),
    poison: term("potion", "poison"),
    none: text("zh-CN", "console.potion_none"),
  },
};
