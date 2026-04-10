import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";

export const VILLAGER_ROLE_PROFILE: RoleProfile = {
  role: Role.Villager,
  label: "平民",
  skillBrief: "无夜间技能，白天通过发言和投票推进局势",
  renderPrompt: () => "你的底牌是【平民】。你没有夜间技能。",
};
