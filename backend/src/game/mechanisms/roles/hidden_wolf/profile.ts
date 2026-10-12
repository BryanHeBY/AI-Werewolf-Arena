/**
 * Assembles hidden wolf wolf profile inheritance, private knife-inheritance state and camp-inspection configuration.
 * Inputs are role initialization/configuration and existing runtime contexts; output is
 * a RoleProfile contribution. Native state access delegates to its owning feature leaf.
 * Existing validation, lifecycle and effect ordering remain their specific contributions;
 * This module does not own archive encoding or create a second state store.
 */
import { HIDDEN_WOLF_CAMP_INSPECTION_POLICIES } from "../../../../core/domain/board";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getHiddenWolfState, setHiddenWolfState } from "./state";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { canHiddenWolfKnife } from "./inheritance";

const parameters = z.strictObject({
  campInspection: z.enum(HIDDEN_WOLF_CAMP_INSPECTION_POLICIES).default("awa_inheritance_v1"),
});

export const HIDDEN_WOLF_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.HiddenWolf,
  maxCount: 1,
  canSelfDestruct: false,
  label: roleName("hidden_wolf"),
  skillBrief: text("zh-CN", "role.hidden_wolf.brief"),
  init: (role, ctx) => {
    setHiddenWolfState(role, {
      hasInheritedKnife: false,
      ...(ctx.boardConfig?.hiddenWolf?.campInspection === "netease_2020_good_v1"
        ? { campInspection: ctx.boardConfig.hiddenWolf.campInspection }
        : {}),
    });
  },
  wolfTeam: (role, world) => ({
    recognizedByPack: false,
    recognizes: "all",
    canChat: false,
    canVoteForKill: canHiddenWolfKnife(role, world),
  }),
  inspectionLabels: (role) => {
    const state = getHiddenWolfState(role),
      inherited = state?.hasInheritedKnife === true;
    return {
      camp:
        state?.campInspection === "netease_2020_good_v1"
          ? Camp.Good
          : inherited
            ? Camp.Wolf
            : Camp.Good,
      role: inherited ? Role.HiddenWolf : Role.Villager,
    };
  },
  detectableByBear: (_world, role) => getHiddenWolfState(role)?.hasInheritedKnife === true,
  renderPrompt: (role, locale = "zh-CN", world) =>
    text(
      locale,
      getHiddenWolfState(role)?.campInspection === "netease_2020_good_v1"
        ? "role.hidden_wolf.state_good_v1"
        : "role.hidden_wolf.state",
    ) +
    " " +
    text(locale, "role.hidden_wolf.status", {
      inherited: text(
        locale,
        getHiddenWolfState(role)?.hasInheritedKnife === true ? "common.yes" : "common.no",
      ),
      active: text(locale, canHiddenWolfKnife(role, world) ? "common.yes" : "common.no"),
    }),
  configuration: {
    schema: parameters,
    defaults: { campInspection: "awa_inheritance_v1" },
    apply: (config, value) => ({ ...config, hiddenWolf: parameters.parse(value) }),
    serialize: (config) => parameters.parse(config.hiddenWolf ?? {}),
  },
  toolSpecs: WOLF_ROLE_PROFILE.toolSpecs!.filter((spec) => spec.name === "kill_vote"),
};
