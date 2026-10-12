/**
 * Runs Ghost Bride partner chat and wedding knife stages. Inputs are the bound wedding night and
 * validated choices; outputs preserve chat settlement, sourced knife claims and stale-knife
 * removal. Wedding authority owns payment and closure; these stages do not make an old pending
 * turn valid again.
 */
import { StatusMark, COMPONENT } from "../../../../core/domain";
import { aliveLifeVersion, type AliveComponent } from "../../../../core/domain/components/alive";
import type { NightStageHandler, NightStageState } from "../../stages/night/contracts";
import type { World } from "../../../../core/domain";
import { executeWeddingTurn } from "./setup";
import {
  weddingPair,
  weddingNightCapture,
  resolveWeddingKnife,
  weddingKnifeCurrent,
} from "./authority";
export const WEDDING_CHAT_STAGE: NightStageHandler = {
  id: "ghost_bride_chat",
  priority: 150,
  async execute(ctx) {
    const day = ctx.currentDay(),
      pair = weddingPair(ctx.world);
    if (
      day === 1 ||
      !pair ||
      ![pair.brideId, pair.groomId].every(
        (id) => ctx.world.getComponent(id, COMPONENT.Alive)?.alive === true,
      )
    )
      return;
    for (const actorId of [pair.brideId, pair.groomId])
      await executeWeddingTurn({
        world: ctx.world,
        gateway: ctx.toolGateway,
        events: ctx.events,
        provider: ctx.actionProvider,
        day,
        actorId,
        kind: "chat",
        tool: "speak_to_partner",
        stage: "ghost_bride_chat",
        isCurrent: ctx.isCurrent,
      });
  },
};
export const WEDDING_KNIFE_STAGE: NightStageHandler = {
  id: "ghost_bride_knife",
  priority: 400,
  async execute(ctx) {
    const day = ctx.currentDay(),
      capture = weddingNightCapture(ctx.world, day);
    if (!capture) throw new Error("ghost_bride_capture_missing");
    for (const actorId of capture.actorIds) {
      const tool = capture.owner === "ordinary_pack" ? "kill_vote" : "wedding_kill_vote";
      await executeWeddingTurn({
        world: ctx.world,
        gateway: ctx.toolGateway,
        events: ctx.events,
        provider: ctx.actionProvider,
        day,
        actorId,
        kind: "knife",
        tool,
        stage: capture.owner === "ordinary_pack" ? "wolf_vote" : "ghost_bride_knife",
        isCurrent: ctx.isCurrent,
      });
      // Domain votes remain in the owned authority; the controller never reconstructs ballots.
    }
    const targetId = resolveWeddingKnife(ctx.world, day);
    ctx.events.push({
      timestamp: Date.now(),
      type: "ghost_bride_knife_resolved",
      payload: { ...capture, actorIds: [...capture.actorIds], targetId },
      audience: Object.freeze(
        capture.owner === "ordinary_pack" ? [] : [...capture.actorIds].sort((a, b) => a - b),
      ),
    });
    ctx.state.wolfTarget = targetId;
    if (targetId !== null && weddingKnifeCurrent(ctx.world, day, targetId)) {
      const marks = ctx.ensureMarks(targetId),
        life = ctx.world.getComponent(targetId, COMPONENT.Alive)!;
      marks.add(StatusMark.WolfKillMark);
      ctx.state.wolfTargetScope = { targetId, life, version: aliveLifeVersion(life)!, marks };
    }
  },
};
/** Owner authorization stays live through Witch/Seer and the actual damage commit. */
export function discardStaleWeddingKnife(world: World, day: number, state: NightStageState): void {
  const scope = state.wolfTargetScope;
  if (!scope || weddingKnifeCurrent(world, day, scope.targetId)) return;
  scope.marks.remove(StatusMark.WolfKillMark);
  state.wolfTarget = null;
  state.wolfTargetScope = undefined;
}
