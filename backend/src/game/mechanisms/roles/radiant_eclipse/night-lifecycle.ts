/**
 * Owns Radiant's pipeline night acquisition and its original terminal calls.
 * Inputs are delegated original World/events and the captured actual night day;
 * writes retain begin-before-acquisition and native close-before-publication order.
 * Normal close never suppresses acquired finally abort or its argument reads:
 * the existing frame's closed guard alone owns repeated terminal no-ops.
 * This unit never queries actors, advances phases, refunds stock or records I/O.
 */
import type { World } from "../../../../core/domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { beginRadiantNight, closeRadiantNight } from "./night_frame";

export interface RadiantNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}

export class RadiantNightUnit {
  private acquired = false;
  constructor(
    private readonly runtime: RadiantNightRuntime,
    private readonly day: number,
  ) {}

  open(): void {
    beginRadiantNight(this.runtime.world, this.day);
    this.acquired = true;
  }

  closeNormally(): void {
    closeRadiantNight(this.runtime.world, this.day, "committed", this.runtime.events);
  }

  abortIfAcquired(): void {
    if (this.acquired)
      closeRadiantNight(this.runtime.world, this.day, "aborted", this.runtime.events);
  }
}
