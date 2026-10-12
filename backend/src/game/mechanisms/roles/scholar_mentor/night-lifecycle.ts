/**
 * Owns Scholar/Mentor's pipeline cleanup transfer and manager terminal-call port.
 * Inputs are delegated original World reads and manager-supplied World/day;
 * outputs retain original grant-resolution errors and frame abort writes.
 * Opening remains in the priority-50 stage, while configured cleanup runs even
 * before that stage. Only the original late transfer suppresses pipeline abort.
 * Manager abort still receives its World after normal close; the frame's closed
 * guard alone prevents poisoning the next night with an aborted modifier window.
 * This unit never grants a bonus, spends caster stock, starts a stage or records I/O.
 */
import type { World } from "../../../../core/domain/world";
import { closeScholarMentorNight, abortScholarMentorNight } from "./night_frame";

export interface ScholarMentorNightRuntime {
  readonly world: World;
}

export const scholarMentorNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeScholarMentorNight(world, day);
  },
  abort(world: World): void {
    abortScholarMentorNight(world);
  },
});

export class ScholarMentorNightUnit {
  private transferred = false;
  constructor(private readonly runtime: ScholarMentorNightRuntime) {}

  transferToManager(configured: boolean): void {
    this.transferred = configured;
  }

  abortIfOwned(): void {
    if (!this.transferred) abortScholarMentorNight(this.runtime.world);
  }
}
