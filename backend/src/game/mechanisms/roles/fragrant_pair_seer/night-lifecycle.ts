/**
 * Owns Fragrant's per-execution night acquisition, publication and terminal close.
 * Inputs are delegated original World/events, the same day/currentness and a lazy
 * knowledge-draw factory; writes retain original authority and publication order.
 * Only an acquired, not normally closed unit attempts abort. Failed opening or
 * publication preserves its existing committed prefix; closure never redraws or
 * refunds paid bindings. Authority retains roster, choices and relationship ownership.
 */
import type { World } from "../../../../core/domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { RandomDraws } from "../../../../core/domain/random";
import { Role } from "@ai-werewolf-arena/game-contract";
import { beginFragrantNight, closeFragrantNight, fragrantAuthoritySnapshot } from "./authority";
import { FRAGRANT_PAIR_POLICY } from "./state";

export interface FragrantNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  drawKnowledge(): RandomDraws;
  recordOpening(day: number, notice: ReturnType<typeof beginFragrantNight>): void;
}

export class FragrantNightUnit {
  private acquired = false;
  private closed = false;
  constructor(
    private readonly runtime: FragrantNightRuntime,
    private readonly day: number,
  ) {}
  open(isCurrent: () => boolean): void {
    const ctx = this.runtime,
      day = this.day;
    const before = fragrantAuthoritySnapshot(ctx.world),
      notice = beginFragrantNight(ctx.world, day, ctx.drawKnowledge(), isCurrent),
      after = fragrantAuthoritySnapshot(ctx.world);
    this.acquired = true;
    ctx.events.push({
      timestamp: Date.now(),
      type: "fragrant_night_opened",
      payload: {
        policy: FRAGRANT_PAIR_POLICY,
        actorId: after.phantomId,
        day,
        knowledgeDrawCount: day === 1 ? 1 : 0,
      },
      audience: Object.freeze([]),
    });
    for (const old of before.fragrant.bindings.filter((b) => b.status.kind === "pending")) {
      if (after.fragrant.bindings.find((b) => b.id === old.id)?.status.kind === "expired")
        ctx.events.push({
          timestamp: Date.now(),
          type: "fragrant_binding_expired",
          payload: {
            policy: FRAGRANT_PAIR_POLICY,
            actorId: ctx.world.getEntityIdsByRole(Role.FragrantPhantom)[0]!,
            day,
            bindingId: old.id,
            createdNight: old.createdNight,
            pairIds: old.pairIds,
          },
          audience: Object.freeze([]),
        });
    }
    if (notice)
      ctx.events.push({
        timestamp: Date.now(),
        type: "fragrant_night_notified",
        payload: { policy: FRAGRANT_PAIR_POLICY, ...notice },
        audience: Object.freeze([notice.actorId]),
      });
    ctx.recordOpening(day, notice);
  }
  closeNormally(): void {
    closeFragrantNight(this.runtime.world, this.day, "normal");
    this.closed = true;
  }
  abortIfOwned(): void {
    if (this.acquired && !this.closed) closeFragrantNight(this.runtime.world, this.day, "aborted");
  }
}
