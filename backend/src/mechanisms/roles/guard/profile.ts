import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";
import { setGuardState } from "../private_state";

export const GUARD_ROLE_PROFILE: RoleProfile = {
  role: Role.Guard,
  label: "守卫",
  skillBrief: "每晚可守护一名玩家，通常不可连续同守",
  init: (roleComp) => {
    setGuardState(roleComp, { lastTarget: null });
  },
  renderPrompt: () => "你的底牌是【守卫】。你每晚可以守护一名玩家，且不可连续同守。",
};
