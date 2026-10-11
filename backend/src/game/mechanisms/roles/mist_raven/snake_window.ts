import { Phase, type ActionProvider, type GameEvent } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { MistPendingNight } from "./pending_night";
import {
  assertMistRosterCurrent,
  mistCasterId,
  openSnakeWindow,
  commitSnakeChoice,
} from "./night_frame";

/** PM already claimed its sole pending owner before any preceding blast/badge await. */
export async function decideSnake(
  world: World,
  events: GameEvent[],
  gateway: ToolGateway,
  provider: ActionProvider,
  pending: MistPendingNight,
  isCurrent: () => boolean,
): Promise<number | null> {
  const actorId = mistCasterId(world, "alchemist"),
    day = pending.day;
  const current = () => pending.status === "committing" && isCurrent();
  if (!current()) throw new Error("snake_window_stale");
  assertMistRosterCurrent(world);
  const candidates = pending.snakeTargets(actorId);
  openSnakeWindow(world, day, candidates, current);
  const request = new GameActionRequestFactory(world, events, day).create({
    phase: Phase.Day,
    actorId,
    allowedTools: ["use_snake"],
    stage: "alchemist_snake",
    requiresAction: true,
    summary: { key: "request.summary.alchemist_snake" },
    context: {
      snake_target: pending.wolfTarget,
      snake_candidates: candidates,
      action_failure_policy: "error",
      allow_fallback: false,
    },
  });
  const action = await provider.getAction(request);
  assertMistRosterCurrent(world);
  if (!current()) throw new Error("snake_window_stale");
  if (action?.name !== "use_snake") throw new Error("snake_action_missing");
  const result = gateway.validateAndSanitize(world, actorId, action, { phase: Phase.Day, day });
  assertMistRosterCurrent(world);
  if (!current() || !result.ok || result.sanitizedCall?.name !== "use_snake")
    throw new Error("snake_action_invalid");
  const targetId = result.sanitizedCall.args.target_id;
  commitSnakeChoice(world, day, actorId, targetId);
  events.push({
    timestamp: Date.now(),
    type: "alchemist_snake_chosen",
    payload: { actorId, day, targetId },
    audience: Object.freeze([actorId]),
  });
  return targetId;
}
