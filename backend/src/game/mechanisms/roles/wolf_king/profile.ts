/**
 * Assembles wolf king wolf profile inheritance, native shooting state, death policy and death-shot hook.
 * Inputs are role initialization/configuration and existing runtime contexts; output is
 * a RoleProfile contribution. Native state access delegates to its owning feature leaf.
 * Existing validation, lifecycle and effect ordering remain their specific contributions;
 * This module does not own archive encoding or create a second state store.
 */
import { deathActionConfiguration, renderDeathActionPolicy } from "../death_action_policy";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, permitsDeathShot } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { getWolfKingState, setWolfKingState } from "./state";
import {
  resolveDeathShots,
  DEATH_SHOT_TOOL_SPECS,
  DEATH_SHOT_REPAIR,
  validateDeathShot,
} from "../death_shot";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";

/** AWA wolf-king 1.0: normal pack permissions plus one cause-qualified death shot. */
export const WOLF_KING_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.WolfKing,
  label: roleName("wolf_king"),
  skillBrief: text("zh-CN", "role.wolf_king.brief"),
  configuration: deathActionConfiguration("wolfKing"),
  init: (role, ctx) => {
    setWolfKingState(role, {
      canShoot: true,
      ...(ctx.boardConfig?.wolfKing?.deathActionPolicy !== undefined &&
      ctx.boardConfig.wolfKing.deathActionPolicy !== "awa_qualified_sources_v1"
        ? { deathActionPolicy: ctx.boardConfig.wolfKing.deathActionPolicy }
        : {}),
    });
  },
  renderPrompt: (role, locale = "zh-CN") =>
    text(
      locale,
      (getWolfKingState(role)?.deathActionPolicy ?? "awa_qualified_sources_v1") !==
        "awa_qualified_sources_v1"
        ? "role.wolf_king.configured_state"
        : "role.wolf_king.state",
      {
        remaining: getWolfKingState(role)?.canShoot ? 1 : 0,
      },
    ) +
    " " +
    renderDeathActionPolicy(getWolfKingState(role)?.deathActionPolicy, locale),
  toolSpecs: [...WOLF_ROLE_PROFILE.toolSpecs!, ...DEATH_SHOT_TOOL_SPECS],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    shoot: (ctx) =>
      validateDeathShot(
        ctx,
        ctx.role.role === Role.WolfKing && getWolfKingState(ctx.role)?.canShoot === true,
      ),
  },
  llmRepair: { coerce: { ...WOLF_ROLE_PROFILE.llmRepair?.coerce, ...DEATH_SHOT_REPAIR.coerce } },
  deathHook: (world, ids, sources, choose, events, context) =>
    resolveDeathShots(
      world,
      ids,
      sources,
      choose,
      events,
      {
        role: Role.WolfKing,
        state: getWolfKingState,
        permits: (sources) => permitsDeathShot(sources),
        policy: (state) => state.deathActionPolicy ?? "awa_qualified_sources_v1",
        shotEvent: (actorId, targetId) => ({
          timestamp: Date.now(),
          type: "wolf_king_shot",
          payload: { actorId, targetId },
        }),
      },
      context,
    ),
  baselineAction: (role, request, pickAliveNotSelf, pickAliveByCamp, locale) =>
    request.allowedTools.includes("shoot")
      ? { name: "shoot", args: { target_id: pickAliveByCamp("good") ?? pickAliveNotSelf() } }
      : WOLF_ROLE_PROFILE.baselineAction!(role, request, pickAliveNotSelf, pickAliveByCamp, locale),
};
