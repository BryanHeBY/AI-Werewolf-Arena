/**
 * Runs the first-night Wild Child model-selection window with original participants.
 * Inputs are readonly board policy, provider and request factory; output is the
 * existing selected model or interrupted setup. Local lifecycle owns choice commits
 * and cancellation; this window never changes board parameters or grants a stale turn.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { Phase, type World, type GameEvent, type ActionProvider } from "../../../../core/domain";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import { readWildChildTool } from "./state";
import {
  wildChildBinding,
  wildChildReady,
  openWildChildChoice,
  validWildChildChoice,
  commitWildChildChoice,
  closeWildChildChoice,
  hasActiveWildChild,
} from "./lifecycle";
export class WildChildSetupWindow {
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
    if (hasActiveWildChild(this.world)) throw new Error("wild_child_setup_reentry");
    if (wildChildReady(this.world)) return true;
    const b = wildChildBinding(this.world);
    if (!b || config !== b.config || day !== 1 || !isCurrent())
      throw new Error("wild_child_setup_unavailable");
    let status: "failed" | "cancelled" = "failed";
    try {
      openWildChildChoice(b, isCurrent);
      const request = new GameActionRequestFactory(this.world, this.events, day).create({
        phase: Phase.Night,
        actorId: b.actorId,
        allowedTools: ["choose_wild_model"],
        stage: "wild_child",
        requiresAction: true,
        summary: { key: "turn.wild_child.required" },
        context: { allow_fallback: false, action_failure_policy: "error" },
      });
      if (!validWildChildChoice(b)) {
        status = "cancelled";
        return false;
      }
      const raw = await provider.getAction(request);
      if (!validWildChildChoice(b)) {
        status = "cancelled";
        return false;
      }
      const call = readWildChildTool(raw);
      if (!call) throw new Error("wild_child_required_choice_missing");
      const result = this.gateway.validateAndSanitize(this.world, b.actorId, call, {
        phase: Phase.Night,
        day,
        wildChildScope: b,
      });
      if (!validWildChildChoice(b)) {
        status = "cancelled";
        return false;
      }
      if (!result.ok || !commitWildChildChoice(b, call.args.target_id))
        throw new Error("wild_child_choice_invalid");
      this.events.push({
        timestamp: Date.now(),
        type: "wild_child_model_chosen",
        payload: { actorId: b.actorId, day: 1, targetId: call.args.target_id },
      });
      return true;
    } finally {
      closeWildChildChoice(b, status);
    }
  }
}
