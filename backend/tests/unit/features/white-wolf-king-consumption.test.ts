/**
 * Unit tests for White Wolf King's selected-resource consumption boundary.
 * Inputs are two handwritten living participants and throwing resource/publication
 * ports; literal access order, original errors and unchanged lives are the oracle.
 * The commit returns death proposals and spends stock before publication, while
 * the actual death resolver and window lifetime remain outside this test scope.
 */
import type { WhiteWolfKingState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Role, Camp, Phase, ActionWindow, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { World } from "../../../src/core/domain/world";
import { getWhiteWolfKingState } from "../../../src/game/mechanisms/roles/white_wolf_king/ports";
import { setWhiteWolfKingState } from "../../../src/game/mechanisms/roles/white_wolf_king/state";
import { commitSelfDestructSelection } from "../../../src/game/mechanisms/self_destruct/commit";
function readerPermission(state: WhiteWolfKingState) {
  // @ts-expect-error Ordinary state readers cannot spend a detonation by field assignment.
  state.canDetonate = false;
}
void readerPermission;
function fixture() {
  const world = new World("en"),
    actorId = world.createEntity(),
    targetId = world.createEntity(),
    actor = createRoleComponent(Role.WhiteWolfKing, Camp.Wolf, "en"),
    target = createRoleComponent(Role.Villager, Camp.Good, "en"),
    actorLife = createAliveComponent(true, "en"),
    targetLife = createAliveComponent(true, "en");
  world.addComponent(actorId, COMPONENT.Role, actor);
  world.addComponent(targetId, COMPONENT.Role, target);
  world.addComponent(actorId, COMPONENT.Alive, actorLife);
  world.addComponent(targetId, COMPONENT.Alive, targetLife);
  const state = setWhiteWolfKingState(actor, { canDetonate: true });
  return {
    world,
    actor,
    state,
    actorLife,
    targetLife,
    choice: { actorId, targetId, kind: "white_wolf_king" as const },
  };
}
test("publication failure keeps spent stock, the captured reference and untouched lives", () => {
  const f = fixture(),
    failure = new Error("white_blast_publication_failed"),
    events: GameEvent[] = [],
    accesses: unknown[] = [];
  let available = true;
  Object.defineProperty(f.state, "canDetonate", {
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
    commitSelfDestructSelection(f.world, f.choice, ActionWindow.OnPreVote, Phase.Voting, events);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(accesses).toEqual(["read", ["write", false], "publish"]);
  expect(available).toBe(false);
  expect(getWhiteWolfKingState(f.actor)).toBe(f.state);
  expect(events).toEqual([]);
  expect([f.actorLife.alive, f.targetLife.alive]).toEqual([true, true]);
});
test("resource setter rejection remains the original error before event publication", () => {
  const f = fixture(),
    failure = new Error("white_blast_stock_readonly"),
    events: GameEvent[] = [];
  Object.defineProperty(f.state, "canDetonate", {
    get: () => true,
    set() {
      throw failure;
    },
  });
  let caught: unknown;
  try {
    commitSelfDestructSelection(f.world, f.choice, ActionWindow.OnPreVote, Phase.Voting, events);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(events).toEqual([]);
  expect(f.state.canDetonate).toBe(true);
  expect([f.actorLife.alive, f.targetLife.alive]).toEqual([true, true]);
});
