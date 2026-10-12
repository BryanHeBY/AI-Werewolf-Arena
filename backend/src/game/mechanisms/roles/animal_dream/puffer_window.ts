import { ANIMAL_DREAM_POLICY } from "@ai-werewolf-arena/game-text";
import type { World } from "../../../../core/domain/world";
import type { ActionProvider } from "../../../../core/domain/actions";
import type { GameEvent } from "../../../../core/domain/events";
import { Phase } from "../../../../core/domain/identity";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import {
  animalPufferChoiceActor,
  animalAuthoritySnapshot,
  animalPufferReaction,
} from "./authority";
import {
  openAnimalRequest,
  animalRequestScope,
  readAnimalTool,
  commitAnimalRequest,
  closeAnimalRequest,
} from "./requests";
import { appendAnimalFact } from "./facts";
export async function runAnimalPufferChoice(
  world: World,
  events: GameEvent[],
  provider: ActionProvider,
  gateway: ToolGateway,
  day: number,
  unit: object,
): Promise<readonly number[]> {
  const actorId = animalPufferChoiceActor(world, unit);
  if (actorId === null) return [];
  const request = new GameActionRequestFactory(world, events, day).create({
      actorId,
      phase: Phase.Voting,
      allowedTools: ["puffer_retaliate"],
      stage: "puffer_reaction",
      requiresAction: true,
      summary: { key: "action.puffer_retaliate.directive" },
      context: { allow_fallback: false, action_failure_policy: "error" },
    }),
    scope = openAnimalRequest(world, request, unit);
  try {
    const raw = await provider.getAction(request),
      call = readAnimalTool(raw);
    if (animalRequestScope(world, request) !== scope || call?.name !== "puffer_retaliate")
      throw Error("animal_required_action_invalid");
    const valid = gateway.validateAndSanitize(world, actorId, call, {
      phase: Phase.Voting,
      day,
      animalScope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall) throw Error("animal_required_action_invalid");
    const receipt = commitAnimalRequest(world, scope, valid.sanitizedCall);
    if (!("activate" in receipt)) throw Error("animal_receipt_invalid");
    appendAnimalFact(world, events, "animal_puffer_decided", {
      policy: ANIMAL_DREAM_POLICY,
      actorId,
      ...receipt,
    });
    const targetIds = [...animalPufferReaction(world, unit)];
    if (receipt.activate) {
      appendAnimalFact(world, events, "animal_puffer_revealed", {
        policy: ANIMAL_DREAM_POLICY,
        day,
        actorId,
        reason: "retaliation",
      });
      const snapshot = animalAuthoritySnapshot(world)!;
      appendAnimalFact(world, events, "animal_puffer_targets", {
        policy: ANIMAL_DREAM_POLICY,
        day,
        actorId,
        targetIds,
        round:
          snapshot.policies!.ballotPolicy === "awa_first_ballot_v1"
            ? 1
            : snapshot.unit!.finalRound!,
      });
    }
    return targetIds;
  } finally {
    closeAnimalRequest(scope);
  }
}
