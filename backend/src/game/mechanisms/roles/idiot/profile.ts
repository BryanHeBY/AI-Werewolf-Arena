/**
 * Assembles idiot native reveal state, participation eligibility, prompt text and voted-out hook.
 * Inputs are role initialization/configuration and existing runtime contexts; output is
 * a RoleProfile contribution. Native state access delegates to its owning feature leaf.
 * Existing validation, lifecycle and effect ordering remain their specific contributions;
 * This module does not own archive encoding or create a second state store.
 */
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：白痴角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getIdiotState, setIdiotState } from "./state";
import { idiotVotedOutHook } from "./voted_out_hook";

/** 白痴角色配置。 */
export const IDIOT_ROLE_PROFILE: RoleProfile = {
  role: Role.Idiot,
  camp: Camp.Good,
  label: roleName("idiot"),
  skillBrief: text("zh-CN", "role.idiot.brief"),
  goodSide: "god",
  participation: (role) => {
    const enabled = getIdiotState(role)?.revealed !== true;
    return { canVote: enabled, canBeExiled: enabled, canBeSheriff: enabled };
  },
  init: (roleComp) => {
    setIdiotState(roleComp, { revealed: false });
  },
  renderPrompt: (_roleComp, locale = "zh-CN") => text(locale, "role.idiot.state"),
  votedOutHook: idiotVotedOutHook,
};
