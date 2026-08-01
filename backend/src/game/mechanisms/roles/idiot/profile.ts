/** 文件说明：白痴角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { setIdiotState } from "../private_state";
import { idiotVotedOutHook } from "./voted_out_hook";

/** 白痴角色配置。 */
export const IDIOT_ROLE_PROFILE: RoleProfile = {
  role: Role.Idiot,
  camp: Camp.Good,
  label: "白痴",
  skillBrief: "白天被放逐时自动翻牌免死并失去投票权",
  goodSide: "god",
  init: (roleComp) => {
    setIdiotState(roleComp, { revealed: false });
  },
  renderPrompt: () => "你的底牌是【白痴】。白天被放逐时会自动翻牌免死并失去投票权。",
  votedOutHook: idiotVotedOutHook,
};
