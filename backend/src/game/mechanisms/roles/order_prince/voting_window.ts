import type { ActionProvider, GameEvent } from "../../../../core/domain/model";
import { Phase } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import type { GameActionRequestFactory } from "../../../engine/action_request_factory";
import {
  openOrderPrinceChoice,
  assertOrderPrinceCurrent,
  commitOrderPrinceChoice,
  closeOrderPrinceChoice,
} from "./authority";

/** Only called after the original first ballot, before any exile or PK effects. */
export async function runOrderPrinceChoice(
  world: World,
  requests: GameActionRequestFactory,
  provider: ActionProvider,
  gateway: ToolGateway,
  events: GameEvent[],
  day: number,
  isCurrent: () => boolean,
): Promise<boolean> {
  const actorId = openOrderPrinceChoice(world, day);
  if (actorId === null) return false;
  const current = () => {
    assertOrderPrinceCurrent(world, actorId);
    if (!isCurrent()) throw new Error("order_prince_choice_stale");
  };
  try {
    current();
    const choice = await provider.getAction(
      requests.create({
        phase: Phase.Voting,
        actorId,
        allowedTools: ["reset_exile_vote"],
        stage: "order_prince_choice",
        requiresAction: true,
        summary: { key: "request.summary.order_prince_choice" },
        context: { action_failure_policy: "error", allow_fallback: false },
      }),
    );
    current();
    if (choice?.name !== "reset_exile_vote") throw new Error("order_prince_choice_missing");
    const checked = gateway.validateAndSanitize(world, actorId, choice, {
      phase: Phase.Voting,
      day,
    });
    current();
    if (!checked.ok || checked.sanitizedCall?.name !== "reset_exile_vote")
      throw new Error("order_prince_choice_invalid");
    const activate = checked.sanitizedCall.args.activate;
    commitOrderPrinceChoice(world, actorId, day, activate);
    events.push({
      timestamp: Date.now(),
      type: "order_prince_choice_committed",
      payload: { actorId, day, activate },
      audience: Object.freeze([actorId]),
    });
    if (!activate) return false;
    events.push({
      timestamp: Date.now(),
      type: "order_prince_revote_started",
      payload: { actorId },
    });
    current();
    const speech = await provider.getAction(
      requests.create({
        phase: Phase.Voting,
        actorId,
        allowedTools: ["speak"],
        stage: "order_prince_speech",
        requiresAction: true,
        summary: { key: "request.summary.order_prince_speech" },
        context: { action_failure_policy: "error", allow_fallback: false },
      }),
    );
    current();
    if (speech?.name !== "speak") throw new Error("order_prince_speech_missing");
    const validated = gateway.validateAndSanitize(world, actorId, speech, {
      phase: Phase.Voting,
      day,
    });
    current();
    if (!validated.ok || validated.sanitizedCall?.name !== "speak")
      throw new Error("order_prince_speech_invalid");
    events.push({
      timestamp: Date.now(),
      type: "day_speech",
      payload: { actorId, text: validated.sanitizedCall.args.text },
    });
    return true;
  } finally {
    closeOrderPrinceChoice(world);
  }
}
