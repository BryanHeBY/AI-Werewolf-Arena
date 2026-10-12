/**
 * Assembles hunter death-action policy, native shooting state, tools, death hook and production fallback.
 * Inputs are role initialization/configuration and existing runtime contexts; output is
 * a RoleProfile contribution. Native state access delegates to its owning feature leaf.
 * Existing validation, lifecycle and effect ordering remain their specific contributions;
 * This module does not own archive encoding or create a second state store.
 */
import { deathActionConfiguration, renderDeathActionPolicy } from "../death_action_policy";
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：猎人角色 profile。 */
import { Camp, Role } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getHunterState, setHunterState } from "./state";
import { hunterDeathHook } from "./death_hook";
import { HUNTER_TOOL_SPECS } from "./tool_specs";
import { DEATH_SHOT_REPAIR, validateDeathShot } from "../death_shot";

/** 猎人角色配置。 */
export const HUNTER_ROLE_PROFILE: RoleProfile = {
  role: Role.Hunter,
  camp: Camp.Good,
  label: roleName("hunter"),
  skillBrief: text("zh-CN", "role.hunter.brief"),
  goodSide: "god",
  configuration: deathActionConfiguration("hunter"),
  init: (roleComp, ctx) => {
    setHunterState(roleComp, {
      canShoot: true,
      ...(ctx.boardConfig?.hunter?.deathActionPolicy === "awa_knife_or_exile_v1"
        ? { deathActionPolicy: ctx.boardConfig.hunter.deathActionPolicy }
        : {}),
    });
  },
  renderPrompt: (role, locale = "zh-CN") =>
    text(
      locale,
      getHunterState(role)?.deathActionPolicy === "awa_knife_or_exile_v1"
        ? "role.hunter.configured_state"
        : "role.hunter.state",
    ) +
    " " +
    renderDeathActionPolicy(getHunterState(role)?.deathActionPolicy, locale),
  toolSpecs: HUNTER_TOOL_SPECS,
  validationRules: {
    shoot: (ctx) =>
      validateDeathShot(
        ctx,
        ctx.role.role === Role.Hunter && getHunterState(ctx.role)?.canShoot === true,
      ),
  },
  llmRepair: DEATH_SHOT_REPAIR,
  deathHook: hunterDeathHook,
  baselineAction: (_roleComp, request, pickAliveNotSelf) => {
    if (!request.allowedTools.includes("shoot")) {
      return null;
    }
    const target = pickAliveNotSelf();
    return { name: "shoot", args: { target_id: target } };
  },
};
