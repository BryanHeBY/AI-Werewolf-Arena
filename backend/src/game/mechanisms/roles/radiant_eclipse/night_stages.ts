/**
 * Runs Eclipse swallow and Radiant shelter requests in their declared order. Inputs are the
 * installed night frame and validated target choices; outputs preserve borrowed-resource or
 * shelter commits and events. These stages never infer paid-effect validity from provider
 * return; the frame owns that check.
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase, Role } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { nightAbilityActors, recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { readShelterState, selectShelter } from "./state";
import {
  assertRadiantRosterCurrent,
  eclipseSwallowTargets,
  openEclipseChoice,
  commitEclipseChoice,
  shelterTargets,
  commitRadiantShelter,
} from "./night_frame";
export const ECLIPSE_SWALLOW_STAGE: NightStageHandler = {
  id: "eclipse_swallow",
  priority: 110,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day < 2) return;
    const actorId = ctx.world
      .getAliveEntityIds()
      .find((id) => ctx.world.getComponent(id, COMPONENT.Role)?.role === Role.EclipseMaid);
    if (actorId === undefined) return;
    openEclipseChoice(ctx.world, day);
    const request = ctx.makeRequest(actorId, ["swallow_skill"], {
      stage: "eclipse_swallow",
      swallow_candidates: eclipseSwallowTargets(ctx.world, day),
      allow_fallback: false,
      action_failure_policy: "error",
    });
    assertRadiantRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertRadiantRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("eclipse_swallow_stale");
    if (action?.name !== "swallow_skill") throw new Error("eclipse_swallow_action_missing");
    const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    if (!ctx.isCurrent() || !result.ok || result.sanitizedCall?.name !== "swallow_skill")
      throw new Error("eclipse_swallow_action_invalid");
    commitEclipseChoice(ctx.world, day, result.sanitizedCall.args.target_id, ctx.events);
  },
};
export const RADIANT_SHELTER_STAGE: NightStageHandler = {
  id: "radiant_shelter",
  priority: 120,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day < 2) return;
    for (const { actorId, ability } of nightAbilityActors(ctx.world, "shelter", day)) {
      const scope = captureNightAbilityScope(
        ctx.world,
        actorId,
        ability,
        day,
        () => ctx.isCurrent() && ctx.currentDay() === day,
      );
      if (!scope?.isEligible()) throw new Error("radiant_shelter_owner_stale");
      const request = ctx.makeRequest(actorId, ["cast_shelter"], {
        stage: "radiant_shelter",
        ability_id: ability.id,
        shelter_candidates: shelterTargets(ctx.world, day, actorId, ability.id),
        allow_fallback: false,
        action_failure_policy: "error",
      });
      const action = await ctx.actionProvider.getAction(request);
      if (!scope.isEligible()) throw new Error("radiant_shelter_owner_stale");
      if (action?.name !== "cast_shelter") throw new Error("radiant_shelter_action_missing");
      const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
        abilityId: ability.id,
      });
      if (!scope.isEligible() || !result.ok || result.sanitizedCall?.name !== "cast_shelter")
        throw new Error("radiant_shelter_action_invalid");
      const target = result.sanitizedCall.args.target_id;
      const next = selectShelter(
        readShelterState(ability.state)!,
        day,
        target,
        actorId,
        ctx.world.getAliveEntityIds(),
      );
      commitRadiantShelter(ctx.world, day, actorId, ability, target, ctx.events);
      recordNightAbilityUse(ability, day, target !== null);
      Object.assign(ability.state, next);
    }
  },
};
