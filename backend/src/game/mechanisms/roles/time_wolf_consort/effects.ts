import type { NightStageContext } from "../../stages/night/contracts";
import type { TimeConsortReceipt } from "./night_frame";
import { timeConsortActorId } from "./night_frame";
export function commitTimeConsortEffect(
  ctx: NightStageContext,
  receipt: TimeConsortReceipt | null,
  day: number,
  sourceId: number,
  kind: "check" | "guard" | "poison",
): void {
  if (!receipt) return;
  if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("time_consort_effect_stale");
  const actorId = timeConsortActorId(ctx.world);
  if (actorId === null) throw new Error("time_consort_actor_missing");
  receipt.commit();
  if (receipt.reflected)
    ctx.events.push({
      timestamp: Date.now(),
      type: "time_consort_reflected",
      payload: {
        actorId,
        day,
        sourceId,
        requestedId: receipt.requestedId,
        effectiveId: receipt.effectiveId,
        kind,
      },
      audience: Object.freeze([]),
    });
}
