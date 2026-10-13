/**
 * Composes native mapped/reflected targets and the existing potion request hints.
 * Inputs are deferred context/day/target reads; outputs preserve original target
 * references and readonly receipt views without exposing a receipt commit method.
 * Every board check and resolver argument is evaluated at its old position.
 * Binding never selects an actor, snapshots inventory, invokes a getter or spends
 * stock. Paid receipt consumption belongs to the separate native effect port.
 */
import type { NightStageContext } from "../game/mechanisms/stages/night/contracts";
import type { NightLifeScope } from "../core/domain/night_effects";
import type { AliveComponent } from "../core/domain/components/alive";
import {
  isMagicianBoard,
  resolveMagicianNightTarget,
  type MagicianResolvedTarget,
} from "../game/mechanisms/roles/magician/ports";
import {
  isTimeConsortBoard,
  resolveTimeConsortTarget,
  type TimeConsortReceipt,
} from "../game/mechanisms/roles/time_wolf_consort/ports";
import {
  isScholarMentorBoard,
  scholarMentorBlocks,
} from "../game/mechanisms/roles/scholar_mentor/ports";

export type NativeTargetScope = Readonly<Omit<NightLifeScope, "life">> & {
  readonly life: Readonly<AliveComponent>;
};
export type NativeMappedTarget = Omit<MagicianResolvedTarget, "scope"> & {
  readonly scope: NativeTargetScope;
};
export type NativeReflectedTarget = Omit<TimeConsortReceipt, "commit" | "scope"> & {
  readonly scope: NativeTargetScope;
};

export interface NativeNightTargetPolicy {
  mappedTarget(day: () => number, targetId: () => number): NativeMappedTarget | null;
  reflectedTarget(
    day: () => number,
    sourceId: () => number,
    targetId: () => number,
    kind: "check" | "guard" | "poison",
  ): NativeReflectedTarget | null;
  potionModifierHints(actorId: number): { modifier_poison_blocked?: boolean };
  potionKnifeHints(): { wolf_targets?: number[] };
}

type TargetRuntime = Pick<NightStageContext, "world" | "currentDay" | "state">;

/** Delegation remains lazy even when a caller's day or target is accessor-backed. */
export function bindNativeNightTargetPolicy(context: () => TargetRuntime): NativeNightTargetPolicy {
  return Object.freeze({
    mappedTarget(day: () => number, targetId: () => number) {
      return isMagicianBoard(context().world)
        ? resolveMagicianNightTarget(context().world, day(), targetId())
        : null;
    },
    reflectedTarget(
      day: () => number,
      sourceId: () => number,
      targetId: () => number,
      kind: "check" | "guard" | "poison",
    ) {
      return isTimeConsortBoard(context().world)
        ? resolveTimeConsortTarget(context().world, day(), sourceId(), targetId(), kind)
        : null;
    },
    potionModifierHints(actorId: number) {
      return isScholarMentorBoard(context().world)
        ? {
            modifier_poison_blocked: scholarMentorBlocks(
              context().world,
              context().currentDay(),
              actorId,
              "poison",
            ),
          }
        : {};
    },
    potionKnifeHints() {
      return isScholarMentorBoard(context().world)
        ? {
            wolf_targets: [
              ...new Set(
                [
                  context().state.wolfTarget,
                  ...(context().state.modifierKnifeTargets ?? []),
                ].filter((id): id is number => id !== null),
              ),
            ],
          }
        : {};
    },
  });
}
