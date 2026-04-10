import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";
import { setHunterState } from "../private_state";

export const HUNTER_ROLE_PROFILE: RoleProfile = {
  role: Role.Hunter,
  label: "猎人",
  skillBrief: "满足条件时可开枪带走一名玩家",
  init: (roleComp) => {
    setHunterState(roleComp, { canShoot: true });
  },
  renderPrompt: () => "你的底牌是【猎人】。满足条件时你可以开枪带走一名玩家。",
};
