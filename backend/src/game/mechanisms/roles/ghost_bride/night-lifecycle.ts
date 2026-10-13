/**
 * Owns Ghost Bride's per-execution opening fact and late cleanup transfer.
 * Inputs are delegated original World/events, day and the already observed setup
 * ownership; outputs retain captured knife facts and the original closing calls.
 * Owned failed capture still closes: no new acquisition guard is introduced.
 * Manager termination stays unconditional at its original two sites. Paid bonds,
 * setup, source validation, victim rules and phase advancement remain elsewhere.
 */
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../core/domain/world";
import { captureWeddingKnife, closeWeddingNight } from "./authority";

export interface WeddingNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}

export const weddingNightTerminal = Object.freeze({
  close(world: World): void {
    closeWeddingNight(world);
  },
});

export class WeddingNightUnit {
  /** Manager receives this same ownership instance; terminal functions keep fresh arguments. */
  readonly close = weddingNightTerminal.close;

  private transferred = false;

  constructor(
    private readonly runtime: WeddingNightRuntime,
    private readonly owned: boolean,
  ) {}

  open(day: number, isCurrent: () => boolean): void {
    const capture = captureWeddingKnife(this.runtime.world, day, isCurrent);
    this.runtime.events.push({
      timestamp: Date.now(),
      type: "ghost_bride_knife_captured",
      payload: { ...capture, actorIds: [...capture.actorIds] },
      audience: Object.freeze([]),
    });
  }

  transferToManager(owned: boolean): void {
    this.transferred = owned;
  }

  abortIfOwned(): void {
    if (this.owned && !this.transferred) closeWeddingNight(this.runtime.world);
  }
}
