/**
 * Owns Trickster's cleanup under the existing shared Magician transfer gate.
 * Inputs are its delegated original World and the same readonly ownership view;
 * outputs retain configured abort and manager finish-before-Day-exile behavior.
 * No independent handedOff/acquired flag is created; priority-100 opening stays
 * stage-owned. Finish leaves the native day mapping open, and only frame authority
 * decides whether abort may close it. Repeated terminal reads remain unsuppressed.
 * This unit never adds outer-cycle cleanup, spends numbers or resolves an exile.
 */
import type { World } from "../../../../core/domain/world";
import type { MagicianNightCleanupOwnership } from "../magician/ports";
import { finishTricksterNight, abortTricksterNight } from "./night_frame";

export interface TricksterNightRuntime {
  readonly world: World;
}

export const tricksterNightTerminal = Object.freeze({
  finishNormally(world: World, day: number): void {
    finishTricksterNight(world, day);
  },
  abort(world: World): void {
    abortTricksterNight(world);
  },
});

export class TricksterNightUnit {
  constructor(
    private readonly runtime: TricksterNightRuntime,
    private readonly ownership: MagicianNightCleanupOwnership,
  ) {}

  abortIfOwned(): void {
    if (!this.ownership.isTransferred()) abortTricksterNight(this.runtime.world);
  }
}
