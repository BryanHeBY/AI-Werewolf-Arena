/**
 * Owns Noble's pipeline night acquisition and its explicit manager handoff.
 * Inputs are original delegated World/events, day/currentness and required recording;
 * writes preserve notices and the acquired-before-publication prefix. After transfer
 * the pipeline cannot normally open or abort this unit. The manager receiver keeps
 * original normal/abort authority behavior, including post-normal bodyResolved checks;
 * it accepts original manager arguments rather than caching a replacement World.
 * Internal result metadata never enters request, MCP, checkpoint or Tape data.
 */
import type { World } from "../../../../core/domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import {
  beginNobleBodyNight,
  abortNobleBodyNight,
  closeNobleBodyNight,
  checkpointNobleBodyAuthority,
} from "./authority";
import { appendNobleBodyNotices } from "./facts";

export type NobleOpeningFact = {
  readonly policy: "awa_noble_secret_body_v1";
  readonly actorId: number;
  readonly day: number;
  readonly notifiedActorIds: number[];
};
export interface NobleNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  recordOpening(payload: NobleOpeningFact): void;
}
export interface NobleNightAbortReceiver {
  abort(world: World, day: number): void;
}
export interface NobleNightReceiver extends NobleNightAbortReceiver {
  closeNormally(world: World, day: number): void;
}
const NOBLE_NIGHT_RECEIVER = Symbol("noble_night_receiver");

/** No World/day/config is observed when the pre-acquisition interrupt receiver is created. */
export function createNobleNightAbortReceiver(): NobleNightAbortReceiver {
  return Object.freeze({
    abort(world: World, day: number) {
      abortNobleBodyNight(world, day);
    },
  });
}

function createNobleNightReceiver(): NobleNightReceiver {
  return Object.freeze({
    closeNormally(world: World, day: number) {
      closeNobleBodyNight(world, day, "normal");
    },
    abort(world: World, day: number) {
      abortNobleBodyNight(world, day);
    },
  });
}

/** Only backend result metadata changes; enumerable data, JSON and spread remain unchanged. */
export function attachNobleNightReceiver<T extends object>(
  result: T,
  receiver: NobleNightAbortReceiver,
): T {
  Object.defineProperty(result, NOBLE_NIGHT_RECEIVER, { value: receiver });
  return result;
}

export function nobleNightReceiver(result: { interrupted: false }): NobleNightReceiver;
export function nobleNightReceiver(result: object): NobleNightAbortReceiver;
export function nobleNightReceiver(result: object): NobleNightAbortReceiver {
  const receiver = Object.getOwnPropertyDescriptor(result, NOBLE_NIGHT_RECEIVER)?.value as
    NobleNightAbortReceiver | undefined;
  if (!receiver) throw new Error("noble_night_receiver_missing");
  return receiver;
}

export class NobleNightUnit {
  private acquired = false;
  private transferred = false;
  readonly receiver = createNobleNightReceiver();
  constructor(
    private readonly runtime: NobleNightRuntime,
    private readonly day: number,
  ) {}
  open(isCurrent: () => boolean): void {
    if (this.transferred) throw new Error("noble_night_pipeline_ownership_transferred");
    const ctx = this.runtime,
      day = this.day;
    const notices = beginNobleBodyNight(ctx.world, day, isCurrent);
    this.acquired = true;
    appendNobleBodyNotices(ctx.events, notices);
    const payload = {
      policy: "awa_noble_secret_body_v1" as const,
      actorId: checkpointNobleBodyAuthority(ctx.world, true).nobleId,
      day,
      notifiedActorIds: notices.map((n) => n.actorId),
    };
    ctx.events.push({
      timestamp: Date.now(),
      type: "noble_body_night_opened",
      payload,
      audience: Object.freeze([]),
    });
    ctx.recordOpening(payload);
  }
  transferToManager(): void {
    this.transferred = true;
  }
  abortIfOwned(): void {
    if (this.acquired && !this.transferred) abortNobleBodyNight(this.runtime.world, this.day);
  }
}
