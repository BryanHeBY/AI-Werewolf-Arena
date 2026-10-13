/**
 * Owns Mist/Raven's pipeline opening fact and cleanup responsibility transfer.
 * Inputs are delegated original World/events and the actual night day; outputs
 * retain begin-before-notice publication and the existing damage handoff result.
 * Business damage capture does not transfer cleanup: only the original late
 * transfer point does. Configured abort still runs after a partially failed begin.
 * Manager terminal calls accept its current World/day and never skip repeated
 * abort after normal close. The frame alone owns paid choices and snake windows;
 * this unit never resolves damage, refunds stock or advances the manager phase.
 */
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../core/domain/world";
import { beginMistNight, handOffMistNight, closeMistNight, abortMistNight } from "./night_frame";

export interface MistNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}

export const mistNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeMistNight(world, day);
  },
  abort(world: World): void {
    abortMistNight(world);
  },
});

export class MistNightUnit {
  /** Manager receives this same ownership instance; terminal functions keep fresh arguments. */
  readonly closeNormally = mistNightTerminal.closeNormally;
  readonly abort = mistNightTerminal.abort;

  private transferred = false;
  constructor(
    private readonly runtime: MistNightRuntime,
    private readonly day: number,
  ) {}

  open(): void {
    const unsealed = beginMistNight(this.runtime.world, this.day);
    if (unsealed)
      this.runtime.events.push({
        timestamp: Date.now(),
        type: "raven_unsealed",
        payload: { ...unsealed, day: this.day, awakened: true },
        audience: Object.freeze([unsealed.actorId]),
      });
  }

  /** Caller supplies World before evaluating the original wolf-target argument. */
  captureDamage(world: World, day: number, wolfTarget: number | null) {
    return handOffMistNight(world, day, wolfTarget);
  }

  transferToManager(ownsMist: boolean): void {
    this.transferred = ownsMist;
  }

  abortIfOwned(): void {
    if (!this.transferred) abortMistNight(this.runtime.world);
  }
}
