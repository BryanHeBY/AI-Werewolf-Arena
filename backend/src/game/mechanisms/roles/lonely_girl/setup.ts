/**
 * Drives Lonely Girl's first-night admired-player choice and existing retry path.
 * Inputs are readonly rules, original roster and action provider; output is the
 * selected target or setup interruption. Participant validity and stock remain
 * lifecycle-owned, and a failed or closed choice never rewrites game parameters.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { Phase, type World, type GameEvent, type ActionProvider } from "../../../../core/domain";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import { LONELY_GIRL_POLICY, readLonelyGirlTool } from "./state";
import {
  lonelyGirlBinding,
  lonelyGirlReady,
  hasActiveLonelyGirl,
  openLonelyGirlChoice,
  validLonelyGirlChoice,
  commitLonelyGirlChoice,
  closeLonelyGirlChoice,
} from "./lifecycle";
export class LonelyGirlSetupWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
    private readonly events: GameEvent[],
  ) {}
  async execute(
    config: ReadonlyBoardConfig,
    provider: ActionProvider,
    day: number,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (hasActiveLonelyGirl(this.world)) throw new Error("lonely_girl_setup_reentry");
    if (lonelyGirlReady(this.world)) return true;
    const b = lonelyGirlBinding(this.world);
    if (!b || b.status !== "pending" || config !== b.config || day !== 1)
      throw new Error("lonely_girl_setup_unavailable");
    let status: "failed" | "cancelled" = "failed";
    try {
      if (!openLonelyGirlChoice(b, isCurrent)) {
        status = "cancelled";
        return false;
      }
      const request = new GameActionRequestFactory(this.world, this.events, day).create({
        phase: Phase.Night,
        actorId: b.actorId,
        allowedTools: ["choose_admired_player"],
        stage: "lonely_girl",
        requiresAction: true,
        summary: { key: "turn.lonely_girl.required" },
        context: { allow_fallback: false, action_failure_policy: "error" },
      });
      if (!validLonelyGirlChoice(b)) {
        status = "cancelled";
        return false;
      }
      const raw = await provider.getAction(request);
      if (!validLonelyGirlChoice(b)) {
        status = "cancelled";
        return false;
      }
      const call = readLonelyGirlTool(raw);
      if (!call) throw new Error("lonely_girl_required_choice_missing");
      const result = this.gateway.validateAndSanitize(this.world, b.actorId, call, {
        phase: Phase.Night,
        day,
        lonelyGirlScope: b,
      });
      if (!validLonelyGirlChoice(b)) {
        status = "cancelled";
        return false;
      }
      if (!result.ok) throw new Error("lonely_girl_choice_invalid");
      const camp = commitLonelyGirlChoice(b, call.args.target_id);
      if (!camp) throw new Error("lonely_girl_choice_invalid");
      this.events.push({
        timestamp: Date.now(),
        type: "lonely_girl_admired_chosen",
        payload: {
          policy: LONELY_GIRL_POLICY,
          actorId: b.actorId,
          day: 1,
          targetId: call.args.target_id,
          camp,
        },
      });
      return true;
    } finally {
      closeLonelyGirlChoice(b, status);
    }
  }
}
