import { expect, test } from "bun:test";
import { COMPONENT, ActionWindow, Phase, DeathCause, type AliveComponent } from "../../../src/core";
import { redMoonCandidateWorld } from "../../support/red_moon_candidate_world";
import {
  beginDemonHunterNight,
  freezeDemonHunt,
  closeDemonHunterNight,
  demonHunterCheckpointPlayers,
  demonRedMoonCanBlast,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import { commitSelfDestructSelection } from "../../../src/game/mechanisms/self_destruct/commit";
import { redMoonVotedOutHook } from "../../../src/game/mechanisms/roles/red_moon_apostle/voted_out_hook";
function dayWorld(policy: "ends_game" | "forbidden" = "ends_game") {
  const fixture = redMoonCandidateWorld(policy);
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  closeDemonHunterNight(fixture.world);
  return fixture;
}
test("Red Moon self-destruct commits actual death source and a single public night seal", () => {
  const { world } = dayWorld();
  const events: Parameters<typeof commitSelfDestructSelection>[4] = [];
  expect(demonRedMoonCanBlast(world, 4)).toBe(true);
  expect(
    commitSelfDestructSelection(
      world,
      { kind: "ordinary", actorId: 4, targetId: null },
      ActionWindow.OnPreVote,
      Phase.Voting,
      events,
    ),
  ).toEqual({ deaths: [4], sources: { 4: [DeathCause.SelfDestruct] } });
  expect(events.map((e) => e.type)).toEqual(["wolf_self_destruct", "red_moon_night_sealed"]);
  expect(events[1]!.payload).toEqual({ actorId: 4, day: 1, night: 2 });
  expect(world.getComponent<AliveComponent>(4, COMPONENT.Alive)!.alive).toBe(true);
  expect(
    commitSelfDestructSelection(
      world,
      { kind: "ordinary", actorId: 4, targetId: null },
      ActionWindow.OnPreVote,
      Phase.Voting,
      events,
    ),
  ).toBeNull();
  expect(events).toHaveLength(2);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
for (const policy of ["ends_game", "forbidden"] as const)
  test(policy + ": actual last-wolf blast has no following-night seal", () => {
    const { world } = dayWorld(policy);
    const events: Parameters<typeof commitSelfDestructSelection>[4] = [];
    for (const id of [1, 2, 3])
      world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
    expect(demonRedMoonCanBlast(world, 4)).toBe(policy === "ends_game");
    const result = commitSelfDestructSelection(
      world,
      { kind: "ordinary", actorId: 4, targetId: null },
      ActionWindow.OnPreElection,
      Phase.Day,
      events,
    );
    if (policy === "forbidden") {
      expect(result).toBeNull();
      expect(events).toEqual([]);
    } else {
      expect(result?.deaths).toEqual([4]);
      expect(events.map((e) => e.type)).toEqual(["wolf_self_destruct"]);
    }
    expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
  });
test("Red Moon exile hook defers only the original last wolf and preserves its life", () => {
  const { world } = dayWorld();
  const events: Parameters<typeof redMoonVotedOutHook>[2] = [];
  expect(redMoonVotedOutHook(world, 4, events)).toBeNull();
  expect(redMoonVotedOutHook(world, 5, events)).toBeNull();
  for (const id of [1, 2, 3])
    world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
  expect(redMoonVotedOutHook(world, 4, events)).toEqual({
    prevented: true,
    removed: [],
    reason: "red_moon_exile_delayed",
  });
  expect(events.map((e) => e.type)).toEqual(["red_moon_exile_delayed"]);
  expect(events[0]!.payload).toEqual({ actorId: 4, day: 1, night: 2 });
  expect(world.getComponent<AliveComponent>(4, COMPONENT.Alive)!.alive).toBe(true);
  expect(demonRedMoonCanBlast(world, 4)).toBe(false);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Red Moon rejects an unsupported self-destruct window before consuming state", () => {
  const { world } = dayWorld();
  const events: Parameters<typeof commitSelfDestructSelection>[4] = [];
  expect(
    commitSelfDestructSelection(
      world,
      { kind: "ordinary", actorId: 4, targetId: null },
      ActionWindow.OnDaybreak,
      Phase.Day,
      events,
    ),
  ).toBeNull();
  expect(events).toEqual([]);
  expect(demonRedMoonCanBlast(world, 4)).toBe(true);
});
