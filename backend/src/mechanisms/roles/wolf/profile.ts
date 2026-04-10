import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";

export const WOLF_ROLE_PROFILE: RoleProfile = {
  role: Role.Wolf,
  label: "狼人",
  skillBrief: "夜间可狼队夜聊并参与刀人投票",
  renderPrompt: () => "你的底牌是【狼人】。你可以参与夜间战术交流和刀人投票。",
};
