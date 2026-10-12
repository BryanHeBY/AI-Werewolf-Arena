/**
 * Requests sheriff speaking direction and builds the resulting seat order. Inputs are current
 * seat identities, alive IDs and the validated direction; outputs preserve the default direction
 * and sheriff-last ordering. It does not assign the badge or change player life.
 */
import { COMPONENT } from "../../../core/domain/components/names";
import { IdentityComponent } from "../../../core/domain/entities/player";
import { ActionProvider, EntityId, GameEvent, Phase } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import { GameActionRequestFactory } from "../../engine/action_request_factory";
import { findSheriffId } from "./badge";

export type SpeakerDirection = "clockwise" | "counter_clockwise";

export async function chooseSpeakerDirection(input: {
  world: World;
  events: GameEvent[];
  toolGateway: ToolGateway;
  actionProvider: ActionProvider;
  day: number;
  enableSheriff: boolean;
}): Promise<SpeakerDirection> {
  const { world, events, toolGateway, actionProvider, day, enableSheriff } = input;
  const defaultDirection: SpeakerDirection = "clockwise";
  if (!enableSheriff) {
    return defaultDirection;
  }

  const sheriffId = findSheriffId(world);
  if (sheriffId === null) {
    return defaultDirection;
  }

  let finalDirection: SpeakerDirection = defaultDirection;
  const requests = new GameActionRequestFactory(world, events, day);
  const req = requests.create({
    phase: Phase.Day,
    actorId: sheriffId,
    allowedTools: ["choose_direction"],
    stage: "sheriff_choose_direction",
    requiresAction: true,
    summary: { key: "request.summary.sheriff_direction" },
    context: {},
  });
  const action = await actionProvider.getAction(req);
  if (action?.name === "choose_direction") {
    const result = toolGateway.validateAndSanitize(world, sheriffId, action, {
      phase: Phase.Day,
    });
    if (result.ok && result.sanitizedCall) {
      finalDirection = result.sanitizedCall.args.direction;
    }
  }

  events.push({
    timestamp: Date.now(),
    type: "sheriff_direction_chosen",
    payload: {
      sheriffId,
      direction: finalDirection,
    },
  });

  return finalDirection;
}

export function buildSpeakerOrder(
  world: World,
  aliveIds: EntityId[],
  sheriffId: EntityId | null,
  direction: SpeakerDirection,
): EntityId[] {
  if (sheriffId === null) {
    return [...aliveIds];
  }

  const seatMap = new Map<EntityId, number>();
  for (const id of aliveIds) {
    const identity = world.getComponent(id, COMPONENT.Identity);
    seatMap.set(id, identity?.seat ?? id);
  }

  const orderedBySeat = [...aliveIds].sort((a, b) => (seatMap.get(a) ?? a) - (seatMap.get(b) ?? b));
  const sheriffIndex = orderedBySeat.indexOf(sheriffId);
  if (sheriffIndex < 0) {
    return orderedBySeat;
  }

  if (direction === "clockwise") {
    return [...orderedBySeat.slice(sheriffIndex + 1), ...orderedBySeat.slice(0, sheriffIndex + 1)];
  }

  const counterClockwise: EntityId[] = [];
  for (let i = sheriffIndex - 1; i >= 0; i--) {
    counterClockwise.push(orderedBySeat[i]);
  }
  for (let i = orderedBySeat.length - 1; i > sheriffIndex; i--) {
    counterClockwise.push(orderedBySeat[i]);
  }
  counterClockwise.push(sheriffId);
  return counterClockwise;
}
