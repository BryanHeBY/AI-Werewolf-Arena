import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：平民角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";

/** 平民角色配置。 */
export const VILLAGER_ROLE_PROFILE: RoleProfile = {
  role: Role.Villager,
  camp: Camp.Good,
  label: roleName("villager"),
  skillBrief: text("zh-CN", "role.villager.brief"),
  goodSide: "villager",
  renderPrompt: (_roleComp, locale = "zh-CN") => text(locale, "role.villager.state"),
};
