import { roleName, text, term } from "@ai-werewolf-arena/game-text";
/** 文件说明：预言家角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getSeerState, setSeerState } from "../private_state";
import { numberOrNull } from "../../llm/helpers";
import { SEER_NIGHT_STAGES } from "./night_stages";
import { SEER_TOOL_SPECS } from "./tool_specs";
import { isAliveTarget } from "../../validation/contracts";

/** 预言家角色配置。 */
export const SEER_ROLE_PROFILE: RoleProfile = {
  role: Role.Seer,
  camp: Camp.Good,
  label: roleName("seer"),
  skillBrief: text("zh-CN", "role.seer.brief"),
  goodSide: "god",
  init: (roleComp) => {
    setSeerState(roleComp, {
      lastTarget: null,
      lastIsWerewolf: null,
      history: [],
    });
  },
  renderPrompt: (roleComp, locale = "zh-CN") => {
    const state = getSeerState(roleComp);
    const latest = state && state.lastTarget !== null && state.lastIsWerewolf !== null
      ? ` ${text(locale, "role.seer.latest", { target: state.lastTarget, camp: term("camp", state.lastIsWerewolf ? "wolf" : "good", locale) })}` : "";
    return text(locale, "role.seer.state") + latest;
  },
  toolSpecs: SEER_TOOL_SPECS,
  validationRules: {
    check_identity: ({ world, role, toolCall }) => {
      if (role.role !== Role.Seer) return "非法操作，仅预言家可查验";
      if (toolCall.name !== "check_identity") return "非法操作，工具不匹配";
      if (!isAliveTarget(world, toolCall.args.target_id)) return "非法操作，查验目标必须存活";
      return null;
    },
  },
  nightStages: SEER_NIGHT_STAGES,
  llmRepair: {
    coerce: {
      check_identity: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target };
      },
    },
  },
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("check_identity")) {
      return null;
    }
    const target = pickAliveNotSelf();
    return target !== null ? { name: "check_identity", args: { target_id: target } } : null;
  },
};
