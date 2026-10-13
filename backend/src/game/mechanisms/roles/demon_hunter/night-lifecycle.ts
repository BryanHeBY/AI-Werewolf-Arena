/**
 * Owns Demon Hunter's per-execution acquisition and late cleanup transfer.
 * Inputs are delegated original World reads, the day and existing currentness;
 * outputs retain native opening and the original conditional pipeline close.
 * Acquisition follows a successful begin only; a failed begin receives no new
 * close. Manager terminal calls remain unconditional at their original sites.
 * This unit never changes sealed stock, native lives, paid effects or phases.
 */
import type { World } from "../../../../core/domain/world";
import { beginDemonHunterNight, closeDemonHunterNight } from "./authority";

export interface DemonNightRuntime {
  readonly world: World;
}

export const demonNightTerminal = Object.freeze({
  close(world: World): void {
    closeDemonHunterNight(world);
  },
});

export class DemonNightUnit {
  private acquired = false;
  private transferred = false;

  constructor(private readonly runtime: DemonNightRuntime) {}

  open(day: number, isCurrent: () => boolean): void {
    beginDemonHunterNight(this.runtime.world, day, isCurrent);
    this.acquired = true;
  }

  transferToManager(owned: boolean): void {
    this.transferred = owned;
  }

  abortIfOwned(): void {
    if (this.acquired && !this.transferred) closeDemonHunterNight(this.runtime.world);
  }
}
