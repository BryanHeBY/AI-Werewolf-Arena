/**
 * Owns Time Consort's pipeline cleanup transfer and manager terminal-call port.
 * Inputs are delegated original World reads and manager-supplied World/day;
 * outputs retain the frame's normal-close errors and unvalidated abort writes.
 * Opening remains in the priority-50 stage. Configured pipeline cleanup requires
 * no acquisition bit: only its original late transfer suppresses pipeline abort.
 * Manager abort never skips argument evaluation after a successful normal close.
 * The existing frame alone owns choice stock and exchange receipts; this unit
 * never starts a stage, retargets an effect, refunds resources or advances phases.
 */
import type { World } from "../../../../core/domain/world";
import { closeTimeConsortNight, abortTimeConsortNight } from "./night_frame";

export interface TimeConsortNightRuntime {
  readonly world: World;
}

export const timeConsortNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeTimeConsortNight(world, day);
  },
  abort(world: World): void {
    abortTimeConsortNight(world);
  },
});

export class TimeConsortNightUnit {
  /** Manager receives this same ownership instance; terminal functions keep fresh arguments. */
  readonly closeNormally = timeConsortNightTerminal.closeNormally;
  readonly abort = timeConsortNightTerminal.abort;

  private transferred = false;
  constructor(private readonly runtime: TimeConsortNightRuntime) {}

  transferToManager(configured: boolean): void {
    this.transferred = configured;
  }

  abortIfOwned(): void {
    if (!this.transferred) abortTimeConsortNight(this.runtime.world);
  }
}
