import { Role } from "../../../domain/model";
import { RoleProfile } from "../contracts";
import { setIdiotState } from "../private_state";

export const IDIOT_ROLE_PROFILE: RoleProfile = {
  role: Role.Idiot,
  label: "白痴",
  skillBrief: "白天被放逐可翻牌免死并失去投票权",
  init: (roleComp) => {
    setIdiotState(roleComp, { revealed: false });
  },
  renderPrompt: () => "你的底牌是【白痴】。白天被放逐后可翻牌免死并失去投票权。",
};
