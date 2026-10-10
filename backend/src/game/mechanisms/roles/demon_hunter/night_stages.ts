import type { NightStageHandler } from "../../stages/night/contracts";
import { demonHunterNeedsTurn } from "./authority";
/** Explicit installed candidate Worlds only; no public role profile is registered here. */
export const DEMON_HUNTER_NIGHT_STAGE: NightStageHandler = {
  id: "demon_hunter_action",
  priority: 650,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (!demonHunterNeedsTurn(ctx.world, day)) return;
    const { executeDemonHunterTurn } = await import("./controller");
    await executeDemonHunterTurn({
      world: ctx.world,
      gateway: ctx.toolGateway,
      events: ctx.events,
      provider: ctx.actionProvider,
      day,
    });
  },
};
