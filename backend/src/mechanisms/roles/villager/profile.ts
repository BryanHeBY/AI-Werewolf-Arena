/** 文件说明：平民角色 profile。 */
import { Camp, Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";

/** 平民角色配置。 */
export const VILLAGER_ROLE_PROFILE: RoleProfile = {
  role: Role.Villager,
  camp: Camp.Good,
  label: "平民",
  skillBrief: "无夜间技能，白天通过发言和投票推进局势",
  goodSide: "villager",
  renderPrompt: () => "你的底牌是【平民】。你没有夜间技能。",
};
