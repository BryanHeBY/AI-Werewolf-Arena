/**
 * Unit tests for Knight resource ownership at the existing duel commit boundary.
 * Inputs are handwritten two-player worlds and throwing resource/publication ports;
 * literal access logs, unchanged lives and original error identity are the oracle.
 * These cases verify paid-prefix and capture behavior, not full-day resolution or
 * a new duel policy. Compiler examples reject writes through the public state view.
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { World } from "../../../src/core/domain/world";
import { getKnightState, type KnightState } from "../../../src/game/mechanisms/roles/knight/ports";
import { setKnightState } from "../../../src/game/mechanisms/roles/knight/state";
import { commitKnightDuel } from "../../../src/game/mechanisms/roles/knight/commit";
function compilerExamples(state: KnightState) {
  // @ts-expect-error Readers cannot consume stock by assigning the public field.
  state.canDuel = false;
}
void compilerExamples;
function fixture() {
  const world = new World("en"),
    actorId = world.createEntity(),
    targetId = world.createEntity(),
    actor = createRoleComponent(Role.Knight, Camp.Good, "en"),
    target = createRoleComponent(Role.Wolf, Camp.Wolf, "en"),
    actorLife = createAliveComponent(true, "en"),
    targetLife = createAliveComponent(true, "en");
  world.addComponent(actorId, COMPONENT.Role, actor);
  world.addComponent(targetId, COMPONENT.Role, target);
  world.addComponent(actorId, COMPONENT.Alive, actorLife);
  world.addComponent(targetId, COMPONENT.Alive, targetLife);
  const state = setKnightState(actor, { canDuel: true });
  return { world, actor, state, actorLife, targetLife, choice: { actorId, targetId } };
}
test("publication failure keeps the spent resource without committing deaths", () => {
  const game = fixture(),
    failure = new Error("duel_publication_failed"),
    accesses: unknown[] = [],
    events: GameEvent[] = [];
  let available = true;
  Object.defineProperty(game.state, "canDuel", {
    get() {
      accesses.push("read");
      return available;
    },
    set(value) {
      accesses.push(["write", value]);
      available = value;
    },
  });
  Object.defineProperty(events, "push", {
    value() {
      accesses.push("publish");
      throw failure;
    },
  });
  let caught: unknown;
  try {
    commitKnightDuel(game.world, game.choice, Phase.Day, events);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(accesses).toEqual(["read", ["write", false], "publish"]);
  expect(available).toBe(false);
  expect(getKnightState(game.actor)).toBe(game.state);
  expect(events).toEqual([]);
  expect([game.actorLife.alive, game.targetLife.alive]).toEqual([true, true]);
});
test("resource write rejection propagates the original error before publication", () => {
  const game = fixture(),
    failure = new Error("duel_stock_readonly"),
    events: GameEvent[] = [];
  Object.defineProperty(game.state, "canDuel", {
    get: () => true,
    set() {
      throw failure;
    },
  });
  let caught: unknown;
  try {
    commitKnightDuel(game.world, game.choice, Phase.Day, events);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(events).toEqual([]);
  expect(game.state.canDuel).toBe(true);
  expect([game.actorLife.alive, game.targetLife.alive]).toEqual([true, true]);
});
test("consumption uses the selected slot without another role-state read", () => {
  const game = fixture(),
    stored = game.actor.privateState,
    events: GameEvent[] = [];
  let reads = 0;
  Object.defineProperty(game.actor, "privateState", {
    get() {
      if (++reads > 1) throw new Error("duel_state_read_twice");
      return stored;
    },
  });
  expect(commitKnightDuel(game.world, game.choice, Phase.Day, events)).toEqual({
    deaths: [game.choice.targetId],
    sources: { [game.choice.targetId]: [DeathCause.Duel] },
    endsDay: true,
  });
  expect(reads).toBe(1);
  expect(game.state.canDuel).toBe(false);
  expect(events.map((event) => event.payload)).toEqual([
    { actorId: game.choice.actorId, targetId: game.choice.targetId, result: "wolf" },
  ]);
  expect([game.actorLife.alive, game.targetLife.alive]).toEqual([true, true]);
});
