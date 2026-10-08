import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：白痴角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getIdiotState, setIdiotState } from "../private_state";
import { idiotVotedOutHook } from "./voted_out_hook";

/** 白痴角色配置。 */
export const IDIOT_ROLE_PROFILE: RoleProfile = {
  role: Role.Idiot,
  camp: Camp.Good,
  label: roleName("idiot"),
  skillBrief: text("zh-CN", "role.idiot.brief"),
  goodSide: "god",
  participation: role => { const enabled = getIdiotState(role)?.revealed !== true; return { canVote: enabled, canBeExiled: enabled, canBeSheriff: enabled }; },
  init: (roleComp) => {
    setIdiotState(roleComp, { revealed: false });
  },
  renderPrompt: (_roleComp, locale = "zh-CN") => text(locale, "role.idiot.state"),
  votedOutHook: idiotVotedOutHook,
};
