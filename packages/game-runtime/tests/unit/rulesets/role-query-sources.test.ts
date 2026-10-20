/**
 * 单元测试用明确的 World／阵营替换反例验证角色扩展查询绑定；预期来自手写编号、阵营和资格。
 * 只调用真实参与、查验、队友、熊感知与自爆端口，不推进完整对局或调用模型。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import type { RoleProfile, RoleQueries } from "../../../src/rulesets/roles/contracts";
import { canBeExiled, canBeSheriff, canVote } from "../../../src/engine/participation";
import { resolveInspection } from "../../../src/engine/inspection";
import { knownWolfTeammates } from "../../../src/features/wolf-team/permissions";
import { BearNightFrame } from "../../../src/features/bear/night-frame";
import { canRoleSelfDestruct } from "../../../src/features/self-destruct/capability";

function fixture(actorRole = Role.Villager, camp = Camp.Good) {
  const world = new World();
  for (const [kind, faction] of [
    [actorRole, camp],
    [Role.Wolf, Camp.Wolf],
    [Role.Bear, Camp.Good],
  ] as const) {
    const id = world.createEntity();
    world.addComponent(id, COMPONENT.Role, createRoleComponent(kind));
    world.addComponent(id, COMPONENT.Camp, { camp: faction });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.VotingRight, { canVote: true, weight: 1 });
  }
  Object.assign(world.getComponent(3, COMPONENT.Role)!.privateState, { bear: { history: [] } });
  return { world, role: world.getComponent(1, COMPONENT.Role)! };
}
function profile(role: Role, callbacks: Partial<RoleProfile>): RoleProfile {
  return { role, label: "custom", skillBrief: "custom", ...callbacks };
}
function assertWorldQueries(queries: RoleQueries) {
  expect(queries.entityIds()).toEqual([1, 2, 3]);
  expect(queries.aliveIds()).toEqual([1, 2, 3]);
  expect(queries.roleValue(2)).toBe(Role.Wolf);
  expect(queries.campValue(2)).toBe(Camp.Wolf);
  expect(queries.isAlive(2)).toBe(true);
  expect("world" in queries).toBe(false);
}

test("custom participation reads actual Good camp and living players instead of disabling valid voters", () => {
  const f = fixture();
  let saved: RoleQueries | undefined;
  const catalog = createRoleCatalog([
    profile(Role.Villager, {
      participation(queries) {
        saved = queries;
        assertWorldQueries(queries);
        const allowed = queries.currentCamp() === Camp.Good && queries.isAlive(1);
        return { canVote: allowed, canBeExiled: allowed, canBeSheriff: allowed };
      },
    }),
  ]);
  expect(canVote(f.world, 1, catalog)).toBe(true);
  expect(canBeExiled(f.world, 1, catalog)).toBe(true);
  expect(canBeSheriff(f.world, 1, catalog)).toBe(true);
  f.world.addComponent(1, COMPONENT.Camp, { camp: Camp.Wolf });
  expect(saved!.currentCamp()).toBe(Camp.Wolf);
  expect(canVote(f.world, 1, catalog)).toBe(false);
  f.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  expect(saved!.aliveIds()).toEqual([1, 3]);
  expect(saved!.isAlive(2)).toBe(false);
});

test("custom inspection labels receive World and late current camp without using metadata defaults", () => {
  const f = fixture(Role.Wolf, Camp.Wolf);
  let saved: RoleQueries | undefined;
  const catalog = createRoleCatalog([
    profile(Role.Wolf, {
      inspectionLabels(queries) {
        saved = queries;
        assertWorldQueries(queries);
        return { camp: queries.currentCamp() === Camp.Wolf ? Camp.Good : Camp.ThirdParty };
      },
    }),
  ]);
  expect(resolveInspection(f.world, 1, "camp", catalog)).toEqual({ kind: "camp", camp: Camp.Good });
  f.world.addComponent(1, COMPONENT.Camp, { camp: Camp.Good });
  expect(saved!.currentCamp()).toBe(Camp.Good);
  expect(resolveInspection(f.world, 1, "camp", catalog)).toEqual({
    kind: "camp",
    camp: Camp.ThirdParty,
  });
  f.world.removeComponent(1, COMPONENT.Camp);
  expect(saved!.currentCamp()).toBeUndefined();
});

test("custom teammate and self-destruct callbacks read the current camp and full scalar queries", () => {
  const f = fixture(Role.Wolf, Camp.Wolf);
  let saved: RoleQueries | undefined;
  const catalog = createRoleCatalog([
    profile(Role.Wolf, {
      wolfTeam: { recognizedByPack: true, recognizes: "all", canChat: true, canVoteForKill: true },
      knownTeammates(queries) {
        saved = queries;
        assertWorldQueries(queries);
        return queries.currentCamp() === Camp.Wolf ? queries.entityIds() : [];
      },
      canSelfDestruct(queries) {
        assertWorldQueries(queries);
        return queries.currentCamp() === Camp.Wolf;
      },
    }),
  ]);
  expect(knownWolfTeammates(f.world, 1, catalog)).toEqual([2]);
  const currentCamp = () => f.world.getComponent(1, COMPONENT.Camp);
  expect(canRoleSelfDestruct(f.role, catalog, currentCamp, f.world)).toBe(true);
  f.world.addComponent(1, COMPONENT.Camp, { camp: Camp.Good });
  expect(saved!.currentCamp()).toBe(Camp.Good);
  expect(canRoleSelfDestruct(f.role, catalog, currentCamp, f.world)).toBe(false);
});

test("custom Bear detection receives the sensed player's current camp and living World queries", () => {
  const f = fixture(Role.Wolf, Camp.Wolf);
  const catalog = createRoleCatalog([
    profile(Role.Wolf, {
      detectableByBear(queries) {
        assertWorldQueries(queries);
        return queries.currentCamp() === Camp.Wolf;
      },
    }),
  ]);
  const events: GameEvent[] = [];
  BearNightFrame.capture(f.world, 1, catalog)!.publish(f.world, events, () => true);
  expect(events.map((event) => event.payload)).toEqual([{ day: 1, roared: true }]);
});
