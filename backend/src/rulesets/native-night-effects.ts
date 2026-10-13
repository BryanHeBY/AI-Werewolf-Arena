/**
 * Binds original native paid effect commands and lazy sealed-controller loaders.
 * Inputs are the original stage context, readonly receipts/abilities and deferred
 * effect arguments; outputs retain paid prefixes, modifier facts and reflection.
 * Only this command binding restores the original receipt commit permission.
 * Context, World, events and source getters remain at their original call sites;
 * binding reads none of them and never adds eligibility, refunds or serialization.
 */
import { Role } from "../core/domain/identity";
import type { NightLifeScope } from "../core/domain/night_effects";
import type { NightStageContext } from "../game/mechanisms/stages/night/contracts";
import type { NightAbilityReadView } from "../game/mechanisms/roles/abilities";
import {
  isScholarMentorBoard,
  recordScholarMentorNativeTarget,
  scholarMentorKnifeEligible,
} from "../game/mechanisms/roles/scholar_mentor/ports";
import {
  isEvilKnightBoard,
  commitEvilKnightReflection,
} from "../game/mechanisms/roles/evil_knight/ports";
import {
  commitTimeConsortEffect,
  type TimeConsortReceipt,
} from "../game/mechanisms/roles/time_wolf_consort/ports";
import {
  loadDemonNativeNightController,
  loadDemonNativePotionController,
} from "../game/mechanisms/roles/demon_hunter/ports";
import type { NativeReflectedTarget } from "./native-night-target-policy";

export interface NativeNightEffects {
  commitReflectedTarget(
    receipt: NativeReflectedTarget | null,
    day: number,
    sourceId: number,
    kind: "check" | "guard" | "poison",
  ): void;
  recordModifierTarget(
    day: number,
    actorId: number,
    kind: "check" | "guard" | "poison",
    targetId: () => number | null,
  ): void;
  recordKnifeModifierTarget(targetId: () => number | null): void;
  commitNativeReflection(
    kind: "seer_check" | "poison",
    ability: NightAbilityReadView<"seer_check" | "potion">,
    targetId: number,
    source: () => NightLifeScope,
    isCurrent: () => boolean,
  ): void;
  loadSealedNightController: typeof loadDemonNativeNightController;
  loadSealedPotionController: typeof loadDemonNativePotionController;
}

/** The same context object is handed to the existing paid command, without a copy. */
export function bindNativeNightEffects(context: () => NightStageContext): NativeNightEffects {
  return Object.freeze({
    commitReflectedTarget(
      receipt: NativeReflectedTarget | null,
      day: number,
      sourceId: number,
      kind: "check" | "guard" | "poison",
    ) {
      commitTimeConsortEffect(context(), receipt as TimeConsortReceipt | null, day, sourceId, kind);
    },
    recordModifierTarget(
      day: number,
      actorId: number,
      kind: "check" | "guard" | "poison",
      targetId: () => number | null,
    ) {
      if (isScholarMentorBoard(context().world))
        recordScholarMentorNativeTarget(context().world, day, actorId, kind, targetId());
    },
    recordKnifeModifierTarget(targetId: () => number | null) {
      if (isScholarMentorBoard(context().world)) {
        const actor = context()
          .world.getAliveEntityIds()
          .find((id) => scholarMentorKnifeEligible(context().world, context().currentDay(), id));
        if (actor !== undefined)
          recordScholarMentorNativeTarget(
            context().world,
            context().currentDay(),
            actor,
            "kill",
            targetId(),
          );
      }
    },
    commitNativeReflection(
      kind: "seer_check" | "poison",
      ability: NightAbilityReadView<"seer_check" | "potion">,
      targetId: number,
      source: () => NightLifeScope,
      isCurrent: () => boolean,
    ) {
      if (isEvilKnightBoard(context().world)) {
        if (
          ability.source.kind !== "native" ||
          ability.source.role !== (kind === "seer_check" ? Role.Seer : Role.Witch)
        )
          throw new Error(
            kind === "seer_check"
              ? "evil_knight_seer_source_invalid"
              : "evil_knight_witch_source_invalid",
          );
        const reflection = commitEvilKnightReflection(
          context().world,
          context().state.evilKnightBindings?.get(targetId) ?? null,
          source(),
          kind,
          isCurrent,
        );
        if (reflection) (context().state.retaliationAttacks ??= []).push(reflection);
      }
    },
    loadSealedNightController: loadDemonNativeNightController,
    loadSealedPotionController: loadDemonNativePotionController,
  });
}
