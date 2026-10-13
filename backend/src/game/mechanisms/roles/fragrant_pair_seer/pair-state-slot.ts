/**
 * Owns native pair-state initialization and the audited pair inspection write prefix.
 * Inputs are the original role or an authority-captured pair slot plus validated
 * next history; outputs preserve the same state behind pairSeer and native ability
 * aliases, then update state JSON, use metadata and ability JSON in that order.
 * Authority owns roster/phase/currentness checks and commits its lease afterward.
 * This owner never clones on read, replaces stored state, catches a partial write,
 * refunds a resource or subscribes to request completion.
 * Its pairSeer slot write alone restores container access; the LHS still precedes ability installation and shares its returned state.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import {
  installNativeAbility,
  recordNightAbilityUse,
  type NightAbilityReadView,
} from "../abilities";
import { freshPairSeerState, type PairSeerState } from "./state";
import { assertWritable, plainJson, write } from "./owned-state-data";

/** Captured references and audit snapshots stay on the original Fragrant owner object. */
export interface PairStateSlot {
  readonly pairState: PairSeerState;
  readonly pairAbility: NightAbilityReadView<"pair_check">;
  pairAbilityJson: string;
  pairJson: string;
}

/** The left-hand privateState reference is evaluated before ability installation. */
export function installPairStateSlot(role: RoleComponent): void {
  (role.privateState as { pairSeer: NightAbilityReadView<"pair_check">["state"] }).pairSeer =
    installNativeAbility(role, "pair_check", freshPairSeerState());
}

/** The caller already passed the original currentness and active-ability checks. */
export function commitPairStateSlot(slot: PairStateSlot, next: PairSeerState, day: number): void {
  assertWritable(slot.pairAbility, slot.pairAbility);
  write(slot.pairState, next);
  slot.pairJson = JSON.stringify(next);
  recordNightAbilityUse(slot.pairAbility, day, true);
  slot.pairAbilityJson = plainJson(slot.pairAbility)!;
}
