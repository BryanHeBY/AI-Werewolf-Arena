import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";
import { getWitchState, setWitchState } from "../private_state";

export const WITCH_ROLE_PROFILE: RoleProfile = {
  role: Role.Witch,
  label: "女巫",
  skillBrief: "拥有解药与毒药，可在夜间选择使用",
  init: (roleComp) => {
    setWitchState(roleComp, {
      heal: 1,
      poison: 1,
      canSelfHeal: false,
      healUsedThisNight: false,
      poisonUsedThisNight: false,
    });
  },
  renderPrompt: (roleComp) =>
    `你的底牌是【女巫】。解药:${getWitchState(roleComp)?.heal ?? 0} 毒药:${getWitchState(roleComp)?.poison ?? 0}`,
};
