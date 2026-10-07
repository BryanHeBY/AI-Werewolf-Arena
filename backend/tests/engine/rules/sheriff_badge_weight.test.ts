import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role, type RoleComponent, type VotingRightComponent, type GameEvent } from "../../../src/core";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { assignSheriff, transferOrDestroySheriffBadge } from "../../../src/game/mechanisms/sheriff/badge";
import { EventRegistry } from "../../../src/game/engine/event_registry";

test("configured sheriff weight survives normal transfer and idiot reveal", () => {
  const { world } = bootstrapGame(twelvePlayerStandardConfig);
  const idiot = world.entityIds().find(id => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Idiot)!;
  assignSheriff(world, idiot, { ...twelvePlayerStandardConfig, sheriff: { voteWeight: 2.25 } });
  const events: GameEvent[] = [];
  new EventRegistry().onVotedOut(world, idiot, events);
  const transfer = events.find(event => event.type === "sheriff_badge_transferred")!;
  const next = transfer.payload.toId;
  expect(typeof next).toBe("number");
  expect(world.getComponent<VotingRightComponent>(next as number, COMPONENT.VotingRight)?.weight).toBe(2.25);
  const result = transferOrDestroySheriffBadge(world, next as number, "test", events)!;
  if (result.toId !== null) expect(world.getComponent<VotingRightComponent>(result.toId, COMPONENT.VotingRight)?.weight).toBe(2.25);
});
