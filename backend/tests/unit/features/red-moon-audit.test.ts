/**
 * 单元测试：验证赤月自爆审计的白天权威与最后狼人政策。输入为原日期和名单；单次提交、后续夜晚封印及名单断言为独立预期，保留原 fixture 与审计状态。
 */
import { assignSheriff } from "../../../src/game/mechanisms/sheriff/badge";
import type { BadgeComponent } from "../../../src/domain";
import { freezeDemonHunt } from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import { expect, test } from "bun:test";
import {
  COMPONENT,
  type AliveComponent,
  type RoleComponent,
  type VotingRightComponent,
} from "../../../src/domain";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";
import {
  beginDemonHunterNight,
  closeDemonHunterNight,
  commitDemonRedMoonTransition,
  demonRedMoonNightSealed,
  demonHunterCheckpointPlayers,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/state-slot";
import { idiotVotedOutHook } from "../../../src/rulesets/idiot-exile-outcome";
function dayWorld(policy: "ends_game" | "forbidden" = "ends_game") {
  const fixture = redMoonCandidateWorld(policy);
  beginDemonHunterNight(fixture.world, 1, () => true);
  freezeDemonHunt(fixture.world);
  closeDemonHunterNight(fixture.world);
  return fixture;
}
test("Red Moon blast audit commits once and seals only the next night after death", () => {
  const { world } = dayWorld();
  expect(commitDemonRedMoonTransition(world, 4, "blast", 1)).toBe(true);
  expect(commitDemonRedMoonTransition(world, 4, "blast", 1)).toBe(false);
  expect(() => demonRedMoonNightSealed(world, 2)).toThrow("red_moon_blast_death_unsettled");
  world.getComponent(4, COMPONENT.Alive)!.alive = false;
  expect(demonRedMoonNightSealed(world, 1)).toBe(false);
  expect(demonRedMoonNightSealed(world, 2)).toBe(true);
  expect(demonRedMoonNightSealed(world, 3)).toBe(false);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
for (const policy of ["ends_game", "forbidden"] as const)
  test(policy + ": last-wolf blast authority uses the actual live roster", () => {
    const { world } = dayWorld(policy);
    for (const id of [1, 2, 3])
      world.getComponent(id, COMPONENT.Alive)!.alive = false;
    expect(commitDemonRedMoonTransition(world, 4, "blast", 1)).toBe(policy === "ends_game");
    expect(getRedMoonState(world.getComponent(4, COMPONENT.Role), () => world.getComponent(4, COMPONENT.Camp))!.blastDay).toBe(
      policy === "ends_game" ? 1 : null,
    );
    expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
  });
test("Only last-wolf exile can defer; wrong phase and repeated transitions fail closed", () => {
  const { world } = dayWorld();
  expect(commitDemonRedMoonTransition(world, 4, "exile", 1)).toBe(false);
  for (const id of [1, 2, 3])
    world.getComponent(id, COMPONENT.Alive)!.alive = false;
  expect(commitDemonRedMoonTransition(world, 4, "exile", 2)).toBe(false);
  expect(commitDemonRedMoonTransition(world, 4, "exile", 1)).toBe(true);
  expect(commitDemonRedMoonTransition(world, 4, "exile", 1)).toBe(false);
  expect(commitDemonRedMoonTransition(world, 4, "expire", 1)).toBe(false);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Raw Red Moon inventory tampering cannot become an audited transition", () => {
  const { world } = dayWorld();
  const state = getRedMoonState(world.getComponent(4, COMPONENT.Role), () => world.getComponent(4, COMPONENT.Camp))!;
  (state as { lastWolfBlastPolicy: "ends_game" | "forbidden" }).lastWolfBlastPolicy = "forbidden";
  expect(commitDemonRedMoonTransition(world, 4, "blast", 1)).toBe(false);
  expect(() => demonHunterCheckpointPlayers(world, true)).toThrow();
});
test("Idiot reveal keeps the original-world audit and disables voting without killing", () => {
  const { world } = dayWorld();
  const role = world.getComponent(12, COMPONENT.Role)!;
  const before = (role.privateState as { readonly idiot?: unknown }).idiot;
  const events: Parameters<typeof idiotVotedOutHook>[2] = [];
  expect(idiotVotedOutHook(world, 12, events)?.removed).toEqual([]);
  expect((role.privateState as { readonly idiot?: unknown }).idiot).toEqual({ revealed: true });
  expect((role.privateState as { readonly idiot?: unknown }).idiot).not.toBe(before);
  expect(world.getComponent(12, COMPONENT.VotingRight)!.canVote).toBe(false);
  expect(world.getComponent(12, COMPONENT.Alive)!.alive).toBe(true);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
  expect(idiotVotedOutHook(world, 12, events)?.reason).toBe("idiot_already_revealed");
});
test("Idiot readonly vote stock rejects before consuming reveal", () => {
  const { world } = dayWorld();
  const role = world.getComponent(12, COMPONENT.Role)!;
  Object.defineProperty(world.getComponent(12, COMPONENT.VotingRight)!, "canVote", {
    writable: false,
  });
  expect(() => idiotVotedOutHook(world, 12, [])).toThrow("demon_hunter_idiot_state_revoked");
  expect((role.privateState as { readonly idiot?: unknown }).idiot).toEqual({ revealed: false });
});

for (const getter of [false, true])
  test("Idiot rejects unaudited reveal before reading getter: " + getter, () => {
    const { world } = dayWorld();
    const role = world.getComponent(12, COMPONENT.Role)!;
    let reads = 0;
    if (getter)
      Object.defineProperty((role.privateState as { readonly idiot?: unknown }).idiot, "revealed", {
        get() {
          reads++;
          return true;
        },
        configurable: true,
      });
    else
      (
        (role.privateState as { readonly idiot?: unknown }).idiot as { revealed: boolean }
      ).revealed = true;
    expect(() => idiotVotedOutHook(world, 12, [])).toThrow("demon_hunter_idiot_state_revoked");
    expect(reads).toBe(0);
    expect(world.getComponent(12, COMPONENT.VotingRight)!.canVote).toBe(true);
  });
test("Idiot badge preflight rejects readonly stock before reveal and vote changes", () => {
  const { world } = dayWorld();
  const role = world.getComponent(12, COMPONENT.Role)!;
  Object.defineProperty(world.getComponent(12, COMPONENT.Badge)!, "isSheriff", { writable: false });
  expect(() => idiotVotedOutHook(world, 12, [])).toThrow("demon_hunter_badge_stock_revoked");
  expect((role.privateState as { readonly idiot?: unknown }).idiot).toEqual({ revealed: false });
  expect(world.getComponent(12, COMPONENT.VotingRight)!.canVote).toBe(true);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Red Moon daytime transition rejects an active night and a stale closed day", () => {
  const { world } = dayWorld();
  beginDemonHunterNight(world, 2, () => true);
  expect(commitDemonRedMoonTransition(world, 4, "blast", 1)).toBe(false);
  closeDemonHunterNight(world);
  expect(commitDemonRedMoonTransition(world, 4, "blast", 1)).toBe(false);
  expect(commitDemonRedMoonTransition(world, 4, "blast", 2)).toBe(false);
});

test("Sheriff Idiot reveal transfers its badge without breaking audited metadata", () => {
  const { world, config, catalog } = dayWorld();
  expect(assignSheriff(world, 12, config, catalog)).toBe(true);
  expect(world.getComponent(12, COMPONENT.Badge)!.isSheriff).toBe(true);
  expect(idiotVotedOutHook(world, 12, [])?.reason).toBe("idiot_revealed");
  expect(world.getComponent(12, COMPONENT.Badge)!.isSheriff).toBe(false);
  expect(world.getComponent(12, COMPONENT.VotingRight)!.weight).toBe(0);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Readonly sheriff badge rejects before Idiot reveal or vote consumption", () => {
  const { world, config, catalog } = dayWorld();
  expect(assignSheriff(world, 12, config, catalog)).toBe(true);
  const badge = world.getComponent(12, COMPONENT.Badge)!;
  Object.defineProperty(badge, "isSheriff", { writable: false });
  expect(() => idiotVotedOutHook(world, 12, [])).toThrow("demon_hunter_badge_stock_revoked");
  expect(
    (
      world.getComponent(12, COMPONENT.Role)!.privateState as {
        readonly idiot?: unknown;
      }
    ).idiot,
  ).toEqual({
    revealed: false,
  });
  expect(world.getComponent(12, COMPONENT.VotingRight)!.canVote).toBe(true);
  expect(badge.isSheriff).toBe(true);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
