import { isMagicianBoard, resolveMagicianNightTarget } from "../magician/night_frame";
import { isNightmareBoard } from "../nightmare_shadow/night_frame";
import { commitEvilKnightReflection } from "../evil_knight/state";
import { isEvilKnightBoard, assertEvilKnightNativeActor } from "../evil_knight/night_frame";
/** 文件说明：预言家夜间查验阶段处理。 */
import { demonHunterActorId } from "../demon_hunter/authority";
import { seerTargetAllowed } from "./target_policy";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getSeerState } from "../private_state";
import { resolveInspection } from "../inspection";
import { activeNightAbility, nightAbilityActors, recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";

import { captureInspectionIdentity, commitFoxInspection } from "../cursed_fox/inspection_effect";

const seerCheckStage: NightStageHandler = {
  id: "seer_check",
  priority: 600,
  async execute(ctx): Promise<void> {
    if (demonHunterActorId(ctx.world) !== null) {
      const { executeDemonNativeNight } = await import("../demon_hunter/native_night_controller");
      await executeDemonNativeNight(ctx, "seer_check");
      return;
    }
    for (const { actorId: seerId, ability } of nightAbilityActors(
      ctx.world,
      "seer_check",
      ctx.currentDay(),
    )) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      if (
        isEvilKnightBoard(ctx.world) &&
        (ability.source.kind !== "native" || ability.source.role !== Role.Seer)
      )
        throw new Error("evil_knight_seer_source_invalid");
      assertEvilKnightNativeActor(ctx.world, seerId, Role.Seer);
      const day = ctx.currentDay(),
        scope = captureNightAbilityScope(
          ctx.world,
          seerId,
          ability,
          day,
          () => ctx.isCurrent() && ctx.currentDay() === day,
        );
      if (!scope?.isEligible()) continue;
      const targets = new Map(
        ctx.world.getAliveEntityIds().map((id) => [id, captureNightLife(ctx.world, id)]),
      );
      const identities = new Map(
        [...targets].flatMap(([id, life]) =>
          life ? [[id, captureInspectionIdentity(ctx.world, life)] as const] : [],
        ),
      );
      if (
        !ctx.world.getAliveEntityIds().includes(seerId) ||
        activeNightAbility(
          ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role),
          "seer_check",
          ctx.currentDay(),
          ability.id,
        ) !== ability
      )
        continue;
      const legalTargets = ctx.world
        .getAliveEntityIds()
        .filter(
          (id) =>
            seerTargetAllowed(ability.state, seerId, id) &&
            luckyTargetAllowed(ctx.world, seerId, ability, day, "check", id),
        );
      if (!legalTargets.length) continue;
      const req = ctx.makeRequest(seerId, ["check_identity"], {
        stage: "seer",
        ability_id: ability.id,
        requiresAction: ability.state.actionPolicy !== "awa_optional_v1",
      });
      if (!scope.isEligible()) continue;
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) continue;
      if (action?.name !== "check_identity") {
        if (isMagicianBoard(ctx.world)) throw new Error("magician_seer_action_missing");
        if (isEvilKnightBoard(ctx.world) || isNightmareBoard(ctx.world))
          throw new Error(
            isNightmareBoard(ctx.world)
              ? "nightmare_seer_action_missing"
              : "evil_knight_seer_action_missing",
          );
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, seerId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(),
        abilityId: ability.id,
      });
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) continue;
      if (!result.ok || !result.sanitizedCall) {
        if (isMagicianBoard(ctx.world)) throw new Error("magician_seer_action_invalid");
        if (isEvilKnightBoard(ctx.world) || isNightmareBoard(ctx.world))
          throw new Error(
            isNightmareBoard(ctx.world)
              ? "nightmare_seer_action_invalid"
              : "evil_knight_seer_action_invalid",
          );
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const target = targets.get(targetId);
      if (!target || !livingNightLife(ctx.world, target) || !identities.get(targetId)?.isCurrent())
        continue;
      const mapping = isMagicianBoard(ctx.world)
        ? resolveMagicianNightTarget(ctx.world, day, targetId)
        : null;
      const effectiveId = mapping?.effectiveId ?? targetId;
      const effectiveIdentity = identities.get(effectiveId);
      if (mapping && (!mapping.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("magician_inspection_target_stale");
      const inspection = resolveInspection(ctx.world, effectiveId, "camp", ctx.roleCatalog);
      if (!ctx.isCurrent()) return;
      if (
        !scope.isEligible() ||
        !identities.get(targetId)?.isCurrent() ||
        !livingNightLife(ctx.world, target) ||
        !seerTargetAllowed(ability.state, seerId, targetId) ||
        !luckyTargetAllowed(ctx.world, seerId, ability, day, "check", targetId)
      )
        continue;
      if (mapping && (!mapping.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("magician_inspection_target_stale");
      if (!inspection) continue;
      const isWerewolf = inspection.camp === Camp.Wolf;
      const seerRole = ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role);
      if (!activeNightAbility(seerRole, "seer_check", ctx.currentDay(), ability.id)) continue;
      const seerState = seerRole ? getSeerState(seerRole, ability.id) : undefined;
      if (seerState) {
        seerState.lastTarget = targetId;
        seerState.lastIsWerewolf = isWerewolf;
        seerState.lastResult = { ...inspection };
        seerState.history.push({ targetId, isWerewolf, result: { ...inspection } });
      }

      commitFoxInspection(ctx.world, ctx.state, target, day, () => scope.isOwnerCurrent(true));
      ctx.state.seerChecks.push({ seerId, targetId, isWerewolf, result: { ...inspection } });
      recordNightAbilityUse(ability, ctx.currentDay(), true);
      if (isEvilKnightBoard(ctx.world)) {
        if (ability.source.kind !== "native" || ability.source.role !== Role.Seer)
          throw new Error("evil_knight_seer_source_invalid");
        const reflection = commitEvilKnightReflection(
          ctx.world,
          ctx.state.evilKnightBindings?.get(targetId) ?? null,
          scope.life,
          "seer_check",
          () => scope.isOwnerCurrent() && !ability.disabled && !ability.deathExpired,
        );
        if (reflection) (ctx.state.retaliationAttacks ??= []).push(reflection);
      }
      recordOwnNightAction(ctx.world, seerId, day, "check", targetId, false);
      ctx.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: {
          actorId: seerId,
          ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
          targetId,
          isWerewolf,
          result: { ...inspection },
        },
      });
    }
  },
};

/** 预言家夜间阶段列表。 */
export const SEER_NIGHT_STAGES: NightStageHandler[] = [seerCheckStage];
