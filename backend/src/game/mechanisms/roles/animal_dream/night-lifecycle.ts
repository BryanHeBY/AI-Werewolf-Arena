/**
 * Owns Animal Dream's per-execution acquisition, opening fact and terminal close.
 * Inputs are delegated original World/events, actual night day and currentness;
 * writes keep authority opening before acquisition and fact publication.
 * Only acquired, not normally closed units abort. Failed publication preserves
 * its original authority prefix; this owner never refunds Fox choices, advances
 * a phase or changes Cat/Puffer death and actual-exile units.
 */
import type { World } from "../../../../core/domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { beginAnimalNight, closeAnimalNight } from "./authority";
import { appendAnimalFact } from "./facts";

export interface AnimalNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}
export class AnimalNightUnit {
  private acquired = false;
  private closed = false;
  constructor(
    private readonly runtime: AnimalNightRuntime,
    private readonly day: number,
  ) {}
  open(isCurrent: () => boolean): void {
    const ctx = this.runtime,
      day = this.day;
    beginAnimalNight(ctx.world, day, isCurrent);
    this.acquired = true;
    appendAnimalFact(ctx.world, ctx.events, "animal_night_opened", {
      policy: "awa_animal_dream_v1",
      day,
    });
  }
  closeNormally(): void {
    closeAnimalNight(this.runtime.world, this.day, "normal");
    this.closed = true;
  }
  abortIfOwned(): void {
    if (this.acquired && !this.closed) closeAnimalNight(this.runtime.world, this.day, "aborted");
  }
}
