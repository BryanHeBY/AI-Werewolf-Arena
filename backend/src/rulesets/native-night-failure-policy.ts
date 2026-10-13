/**
 * Composes the existing native night failure and source-qualification policies.
 * Inputs are deferred original World reads, stage kinds and live read-only
 * ability references; outputs are the original rejection or continuation.
 * Every feature lookup retains its original short circuit and repeated World
 * read. Binding never queries a board, actor, resource, clock or request.
 * This query port cannot consume stock, settle a receipt or publish a fact.
 */
import type { World } from "../core/domain/world";
import { Role } from "../core/domain/identity";
import type { NightAbilityReadView } from "../game/mechanisms/roles/abilities";
import { isRadiantEclipseBoard } from "../game/mechanisms/roles/radiant_eclipse/ports";
import { isScholarMentorBoard } from "../game/mechanisms/roles/scholar_mentor/ports";
import { isTimeConsortBoard } from "../game/mechanisms/roles/time_wolf_consort/ports";
import { isMagicianBoard } from "../game/mechanisms/roles/magician/ports";
import { isNightmareBoard } from "../game/mechanisms/roles/nightmare_shadow/ports";
import {
  isEvilKnightBoard,
  assertEvilKnightNativeActor,
} from "../game/mechanisms/roles/evil_knight/ports";
import { isFragrantPairBoard } from "../game/mechanisms/roles/fragrant_pair_seer/ports";
import { isNobleBodyBoard } from "../game/mechanisms/roles/noble_secret_body/ports";
import { isMistRavenBoard } from "../game/mechanisms/roles/mist_raven/ports";
import {
  isRedMoonBoard,
  demonHunterActorId,
  demonWitchRequiredThisNight,
} from "../game/mechanisms/roles/demon_hunter/ports";

export type NativeNightAction = "seer" | "guard" | "witch";

export interface NativeNightFailurePolicy {
  scopeStale(kind: NativeNightAction): void;
  actionMissing(kind: NativeNightAction): void;
  actionInvalid(kind: NativeNightAction): void;
  strictWolfFailurePrefix(): string | null;
  usesDemonController(): boolean;
  requiresDemonPotionTurn(): boolean;
  assertNativeActor(actorId: number, role: Role): void;
  assertSeerSource(ability: NightAbilityReadView<"seer_check">): void;
  assertPotionSource(ability: NightAbilityReadView<"potion">): void;
  skipsEmptyBorrowedPotion(ability: NightAbilityReadView<"potion">): boolean;
}

/** The delegate, rather than a cached World, preserves each original argument read. */
export function bindNativeNightFailurePolicy(world: () => World): NativeNightFailurePolicy {
  const scopeStale = (kind: NativeNightAction): void => {
    if (kind !== "guard" && isRadiantEclipseBoard(world()))
      throw new Error(`radiant_eclipse_${kind}_scope_stale`);
    if (isScholarMentorBoard(world())) throw new Error(`scholar_mentor_${kind}_scope_stale`);
    if (isTimeConsortBoard(world())) throw new Error(`time_consort_${kind}_scope_stale`);
  };
  const actionRejected = (kind: NativeNightAction, reason: "missing" | "invalid"): void => {
    if (kind !== "guard" && isRadiantEclipseBoard(world()))
      throw new Error(`radiant_eclipse_${kind}_action_${reason}`);
    if (isScholarMentorBoard(world())) throw new Error(`scholar_mentor_${kind}_action_${reason}`);
    if (isTimeConsortBoard(world())) throw new Error(`time_consort_${kind}_action_${reason}`);
    if (kind === "guard") {
      if (isEvilKnightBoard(world())) throw new Error(`evil_knight_guard_action_${reason}`);
      return;
    }
    if (isMagicianBoard(world())) throw new Error(`magician_${kind}_action_${reason}`);
    if (isEvilKnightBoard(world()) || isNightmareBoard(world()))
      throw new Error(
        isNightmareBoard(world())
          ? `nightmare_${kind}_action_${reason}`
          : `evil_knight_${kind}_action_${reason}`,
      );
  };
  return Object.freeze({
    scopeStale,
    actionMissing: (kind: NativeNightAction) => actionRejected(kind, "missing"),
    actionInvalid: (kind: NativeNightAction) => actionRejected(kind, "invalid"),
    strictWolfFailurePrefix() {
      if (isFragrantPairBoard(world())) return "fragrant_pair_seer";
      if (isNobleBodyBoard(world())) return "noble_secret_body";
      if (isRadiantEclipseBoard(world())) return "radiant_eclipse";
      if (isMistRavenBoard(world())) return "mist";
      if (isScholarMentorBoard(world())) return "scholar_mentor";
      if (isTimeConsortBoard(world())) return "time_consort";
      if (isNightmareBoard(world())) return "nightmare";
      if (isMagicianBoard(world())) return "magician";
      if (isRedMoonBoard(world())) return "red_moon";
      if (isEvilKnightBoard(world())) return "evil_knight";
      return null;
    },
    usesDemonController: () => demonHunterActorId(world()) !== null,
    requiresDemonPotionTurn: () => demonWitchRequiredThisNight(world()),
    assertNativeActor: (actorId: number, role: Role) =>
      assertEvilKnightNativeActor(world(), actorId, role),
    assertSeerSource(ability: NightAbilityReadView<"seer_check">) {
      if (
        isEvilKnightBoard(world()) &&
        (ability.source.kind !== "native" || ability.source.role !== Role.Seer)
      )
        throw new Error("evil_knight_seer_source_invalid");
    },
    assertPotionSource(ability: NightAbilityReadView<"potion">) {
      if (
        isEvilKnightBoard(world()) &&
        (ability.source.kind !== "native" || ability.source.role !== Role.Witch)
      )
        throw new Error("evil_knight_witch_source_invalid");
    },
    skipsEmptyBorrowedPotion: (ability: NightAbilityReadView<"potion">) =>
      isRadiantEclipseBoard(world()) &&
      ability.source.kind === "copy" &&
      ability.state.heal === 0 &&
      ability.state.poison === 0,
  });
}
