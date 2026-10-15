/**
 * 单元测试：验证雾鸦独立 night frame 的原状态／读接口。输入为内存 fixture、受控回调和畸形修改；原引用、字面值及拒绝断言为预期，不执行装配周期、模型或实体传输。
 */
import { createCampComponent, createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/domain/world";
import { Camp, Role, WinCondition } from "../../../../src/domain/identity";
import type { BoardConfig } from "../../../../src/domain/board";
import { getDreamerState } from "../../../../src/features/dreamer/ports";
import { COMPONENT } from "../../../../src/domain/components/names";
import { type RoleComponent } from "../../../../src/domain/components/role";
import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";

import { type AliveComponent } from "../../../../src/domain/components/alive";
import { createIdentityComponent } from "../../../../src/domain/entities/player";
import { getDefaultRoleCatalog } from "../../../../src/rulesets/roles/role-catalog-assembly";
import {
  createAlchemistState,
  createRavenState,
  type AlchemistState,
} from "../../../../src/features/mist-raven/state";
import {
  installMistRavenBoard,
  beginMistNight,
  assertMistRosterCurrent,
  abortMistNight,
  closeMistNight,
  commitMistChoice,
  mistChoiceTargets,
  mistKnifeTargets,
  originalMistTarget,
  ravenKnownTeammates,
  ravenAwakened,
  ravenKnifeTargets,
  commitRavenKnife,
  handOffMistNight,
  openSnakeWindow,
  snakeWindowTargets,
  commitSnakeChoice,
} from "../../../../src/features/mist-raven/night-frame";
function fixture() {
  const world = new World();
  const roles = [
    "alchemist",
    "seer",
    "dreamer",
    "idiot",
    "villager",
    "villager",
    "villager",
    "villager",
    "raven_claw_wolf",
    "wolf",
    "wolf",
    "wolf",
  ];
  const boardConfig: BoardConfig = {
    boardSize: 12,
    roleSetups: [...new Set(roles)].map((name) => ({
      role: name as Role,
      count: roles.filter((value) => value === name).length,
    })),
    winConditions: [WinCondition.SlaughterSide],
    enableSheriff: true,
    hooks: { onDaybreak: true, onPreElection: true, onPerSpeechGap: true, onPreVote: true },
    dreamer: { protectionPolicy: "netease_2026_night_immunity_v1" },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  };
  roles.forEach((name, index) => {
    const id = world.createEntity(),
      camp = ["raven_claw_wolf", "wolf"].includes(name) ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(name as Role);
    if (name === "alchemist")
      (role.privateState as Record<string, unknown>).alchemist = createAlchemistState();
    else if (name === "raven_claw_wolf")
      (role.privateState as Record<string, unknown>).ravenClaw = createRavenState();
    else getDefaultRoleCatalog().applyRuntime(role, { boardConfig, initialCamp: { camp }, currentCamp: () => world.getComponent(id, COMPONENT.Camp) });
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(
      id,
      COMPONENT.Identity,
      createIdentityComponent(id, index + 1, `Player ${id}`),
    );
  });
  installMistRavenBoard(world);
  expect(
    getDreamerState(world.getComponent(3, COMPONENT.Role)!)?.protectionPolicy,
  ).toBe("netease_2026_night_immunity_v1");
  const kill = (id: number) => {
    world.getComponent(id, COMPONENT.Alive)!.alive = false;
  };
  const healState = () =>
    (
      world.getComponent(1, COMPONENT.Role)!.privateState as {
        readonly alchemist?: unknown;
      }
    ).alchemist as AlchemistState;
  return { world, kill, healState };
}
function passNight(world: World, day: number, knife: number | null = 5) {
  if (mistChoiceTargets(world, day).length >= 3) commitMistChoice(world, day, null);
  if (ravenKnifeTargets(world, day).length > 0) commitRavenKnife(world, day, null);
  const hand = handOffMistNight(world, day, knife);
  if (hand.delayEligible) {
    openSnakeWindow(
      world,
      day,
      knife === null ? [] : knife === 1 && day > 1 ? [] : [knife],
      () => true,
    );
    commitSnakeChoice(world, day, 1, null);
  }
  closeMistNight(world, day);
  return hand;
}
test("actual night owner forbids reentry after completion and abort", () => {
  const { world } = fixture();
  beginMistNight(world, 1);
  expect(() => beginMistNight(world, 1)).toThrow("mist_night_reentry");
  passNight(world, 1);
  expect(() => beginMistNight(world, 1)).toThrow("mist_night_reentry");
  beginMistNight(world, 2);
  abortMistNight(world);
  expect(() => beginMistNight(world, 2)).toThrow("mist_night_reentry");
  expect(() => handOffMistNight(world, 2, null)).toThrow("mist_night_unavailable");
});
test("raven learns only real night-start survivors and retains its later dead known teammate", () => {
  const { world, kill } = fixture();
  expect(beginMistNight(world, 1)).toBeNull();
  expect(ravenAwakened(world)).toBe(false);
  kill(11);
  kill(12);
  expect(ravenAwakened(world)).toBe(false);
  expect(ravenKnownTeammates(world)).toEqual([]);
  passNight(world, 1);
  expect(beginMistNight(world, 2)).toEqual({ actorId: 9, knownTeammateIds: [10] });
  expect(ravenKnifeTargets(world, 2)).toContain(1);
  passNight(world, 2);
  kill(10);
  expect(ravenKnownTeammates(world)).toEqual([10]);
  expect(beginMistNight(world, 3)).toBeNull();
  expect(ravenKnownTeammates(world)).toEqual([10]);
  expect(ravenKnownTeammates(world)).not.toContain(11);
  expect(ravenKnownTeammates(world)).not.toContain(12);
});
test("three living wolves remain sealed at the next real night", () => {
  const { world, kill } = fixture();
  beginMistNight(world, 1);
  passNight(world, 1);
  kill(12);
  expect(beginMistNight(world, 2)).toBeNull();
  expect(ravenAwakened(world)).toBe(false);
  expect(ravenKnifeTargets(world, 2)).toEqual([]);
});
test("one-night mist can include its caster and wolves, and independent snake remains authorized", () => {
  const { world, healState } = fixture();
  beginMistNight(world, 1);
  commitMistChoice(world, 1, [1, 10, 11]);
  expect(mistKnifeTargets(world)).toEqual([1, 10, 11]);
  expect(handOffMistNight(world, 1, 1)).toMatchObject({ delayEligible: true });
  openSnakeWindow(world, 1, [1], () => true);
  expect(snakeWindowTargets(world, 1, 1)).toEqual([1]);
  commitSnakeChoice(world, 1, 1, 1);
  expect(healState()).toMatchObject({ mistRemaining: 0, healRemaining: 0 });
  closeMistNight(world, 1);
  beginMistNight(world, 2);
  expect(mistKnifeTargets(world)).toBeNull();
  expect(mistChoiceTargets(world, 2)).toEqual([]);
  expect(handOffMistNight(world, 2, 5).delayEligible).toBe(false);
  closeMistNight(world, 2);
});
test("snake legal scope is the original knife only, with first-night self-heal and no resurrection", () => {
  const { world, kill, healState } = fixture();
  beginMistNight(world, 1);
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, 10);
  kill(10);
  openSnakeWindow(world, 1, [], () => true);
  expect(snakeWindowTargets(world, 1, 1)).toEqual([]);
  expect(() => commitSnakeChoice(world, 1, 1, 10)).toThrow("snake_choice_target_invalid");
  expect(healState().healRemaining).toBe(1);
  commitSnakeChoice(world, 1, 1, null);
  closeMistNight(world, 1);
  beginMistNight(world, 2);
  commitMistChoice(world, 2, null);
  handOffMistNight(world, 2, 1);
  openSnakeWindow(world, 2, [], () => true);
  expect(() => commitSnakeChoice(world, 2, 1, 1)).toThrow("snake_choice_target_invalid");
  commitSnakeChoice(world, 2, 1, null);
  closeMistNight(world, 2);
});
test("late fake snake target cannot widen a known ordinary knife", () => {
  const { world, healState } = fixture();
  beginMistNight(world, 1);
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, 5);
  expect(() => openSnakeWindow(world, 1, [6], () => true)).toThrow("snake_window_target_invalid");
  expect(() => openSnakeWindow(world, 1, [5], () => true)).toThrow("mist_night_unavailable");
  expect(() => closeMistNight(world, 1)).toThrow("mist_night_unavailable");
  expect(healState().healRemaining).toBe(1);
});
test("a snake scope callback cannot restore an aborted window or consume inventory", () => {
  const { world, healState } = fixture();
  beginMistNight(world, 1);
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, 5);
  openSnakeWindow(world, 1, [5], () => {
    abortMistNight(world);
    return true;
  });
  expect(() => commitSnakeChoice(world, 1, 1, 5)).toThrow("snake_window_revoked");
  expect(healState().healRemaining).toBe(1);
  expect(() => openSnakeWindow(world, 1, [5], () => true)).toThrow("mist_night_unavailable");
});
test("snake scope error is preserved and closes its only owner", () => {
  const { world, healState } = fixture(),
    failure = new RangeError("scope revoked");
  beginMistNight(world, 1);
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, 5);
  openSnakeWindow(world, 1, [5], () => {
    throw failure;
  });
  let actual: unknown;
  try {
    commitSnakeChoice(world, 1, 1, 5);
  } catch (error) {
    actual = error;
  }
  expect(actual).toBe(failure);
  expect(healState().healRemaining).toBe(1);
  expect(() => openSnakeWindow(world, 1, [5], () => true)).toThrow("mist_night_unavailable");
});
test("missing ordinary choices and duplicate snake decisions cannot complete a night", () => {
  const { world } = fixture();
  beginMistNight(world, 1);
  expect(() => handOffMistNight(world, 1, 5)).toThrow("mist_night_choices_unsettled");
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, null);
  expect(() => closeMistNight(world, 1)).toThrow("mist_night_unsettled");
  openSnakeWindow(world, 1, [], () => true);
  commitSnakeChoice(world, 1, 1, null);
  expect(() => commitSnakeChoice(world, 1, 1, null)).toThrow("snake_window_revoked");
  closeMistNight(world, 1);
});
test("raven extra target stays outside the mist and its original life scope is immutable", () => {
  const { world, kill } = fixture();
  beginMistNight(world, 1);
  passNight(world, 1);
  kill(11);
  kill(12);
  beginMistNight(world, 2);
  commitMistChoice(world, 2, [1, 2, 3]);
  expect(ravenKnifeTargets(world, 2)).toContain(5);
  commitRavenKnife(world, 2, 5);
  const hand = handOffMistNight(world, 2, 1);
  expect(hand.extra?.id).toBe(5);
  expect(Object.isFrozen(hand.extra)).toBe(true);
  expect(Object.isFrozen(originalMistTarget(world, 2, 5))).toBe(true);
  expect(() => commitRavenKnife(world, 2, 6)).toThrow("raven_knife_unavailable");
});
for (const edit of [
  "caster_state",
  "noncaster_role",
  "noncaster_identity",
  "noncaster_camp",
  "revival",
  "private_proto",
  "ability_proto",
  "state_proto",
  "policy_getter",
] as const)
  test(`whole native roster revokes unsafe changes/${edit}`, () => {
    const { world, kill } = fixture();
    beginMistNight(world, 1);
    const role = world.getComponent(2, COMPONENT.Role)!;
    const abilities = (role.privateState as { readonly abilities?: unknown }).abilities as Record<
      string,
      { state: object }
    >;
    const ability = Object.values(abilities)[0]!;
    let calls = 0;
    switch (edit) {
      case "caster_state":
        (
          world.getComponent(1, COMPONENT.Role)!.privateState as Record<
            string,
            unknown
          >
        ).alchemist = createAlchemistState();
        break;
      case "noncaster_role":
        role.role = Role.Wolf;
        break;
      case "noncaster_identity":
        world.addComponent(2, COMPONENT.Identity, createIdentityComponent(2, 2, "Player 2"));
        break;
      case "noncaster_camp":
        world.addComponent(2, COMPONENT.Camp, createCampComponent(Camp.Good));
        break;
      case "revival":
        kill(5);
        world.getComponent(5, COMPONENT.Alive)!.alive = true;
        break;
      case "private_proto":
        Object.setPrototypeOf(role.privateState, {});
        break;
      case "ability_proto":
        Object.setPrototypeOf(ability, {});
        break;
      case "state_proto":
        Object.setPrototypeOf(ability.state, {});
        break;
      case "policy_getter":
        Object.defineProperty(ability.state, "targetPolicy", {
          get() {
            calls++;
            return "awa_alive_v1";
          },
          enumerable: true,
          configurable: true,
        });
        break;
    }
    expect(() => assertMistRosterCurrent(world)).toThrow("mist_original_roster_revoked");
    expect(calls).toBe(0);
  });

for (const id of [1, 9])
  test(`installation binds original caster state before any night/${id}`, () => {
    const { world } = fixture(),
      role = world.getComponent(id, COMPONENT.Role)!,
      key = id === 1 ? "alchemist" : "ravenClaw";
    (role.privateState as Record<string, unknown>)[key] = structuredClone(
      (role.privateState as { readonly alchemist?: unknown; readonly ravenClaw?: unknown })[key],
    );
    expect(() => assertMistRosterCurrent(world)).toThrow("mist_original_roster_revoked");
    expect(() => beginMistNight(world, 1)).toThrow("mist_original_roster_revoked");
  });
test("four-wolf night cannot inherit a forged pre-start awakening", () => {
  const { world } = fixture(),
    role = world.getComponent(9, COMPONENT.Role)!;
  (role.privateState as Record<string, unknown>).ravenClaw = {
    ...createRavenState(),
    awakenedDay: 1,
    knownTeammateIds: [10],
  };
  expect(() => beginMistNight(world, 1)).toThrow("mist_original_roster_revoked");
});
test("mist effective targets derive from canonical committed history and never from raw array methods", () => {
  const { world, healState } = fixture();
  beginMistNight(world, 1);
  let calls = 0;
  const targets = [1, 2, 3],
    prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "map", {
    get() {
      calls++;
      return () => [originalMistTarget(world, 1, 5)];
    },
  });
  Object.setPrototypeOf(targets, prototype);
  commitMistChoice(world, 1, targets);
  expect(healState().mistHistory).toEqual([{ day: 1, targetIds: [1, 2, 3] }]);
  expect(mistKnifeTargets(world)).toEqual([1, 2, 3]);
  expect(calls).toBe(0);
  expect(() => handOffMistNight(world, 1, 5)).toThrow("mist_knife_outside_circle");
  expect(() => handOffMistNight(world, 1, null)).toThrow("mist_knife_outside_circle");
  expect(handOffMistNight(world, 1, 2).delayEligible).toBe(true);
});
test("snake effective targets derive from the internal original knife scope", () => {
  const { world } = fixture();
  beginMistNight(world, 1);
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, 5);
  let calls = 0;
  const targets = [5],
    prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "map", {
    get() {
      calls++;
      return () => [originalMistTarget(world, 1, 6)];
    },
  });
  Object.defineProperty(prototype, "some", {
    get() {
      calls++;
      return () => false;
    },
  });
  Object.setPrototypeOf(targets, prototype);
  openSnakeWindow(world, 1, targets, () => true);
  expect(snakeWindowTargets(world, 1, 1)).toEqual([5]);
  expect(calls).toBe(0);
  commitSnakeChoice(world, 1, 1, null);
  closeMistNight(world, 1);
});
