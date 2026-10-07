/** Legacy contributor export; names come from the shared catalog. */
import { roleName } from "@ai-werewolf-arena/game-text";
import { Role } from "../../../core/domain/model";
import type { TextLocalizationContributor } from "../shared/text_localization_registry";
export const ROLE_TEXT_LOCALIZATION_CONTRIBUTOR: TextLocalizationContributor = {
  roleNames: Object.fromEntries(Object.values(Role).map(role => [role, roleName(role)])),
};
