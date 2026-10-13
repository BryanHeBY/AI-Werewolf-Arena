/**
 * 单元测试：验证馥郁双生原生 Pair 与能力生命周期边界。
 * 输入为原内存 roster、callback 和非法状态；字面量、引用与错误／库存断言保持原独立预期。
 * 原 owner、frame 和 readers 真实执行，native/install/use 只迁向同一实际实例 owner。
 * 不运行完整对局、模型或传输，不替换支持 fixture、规则与原历史矩阵。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { Role, Camp } from "../../../../src/core/domain/identity";

import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import type { GameEvent } from "../../../../src/core/domain/events";
import { freshPairSeerState } from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/state";
import {
  findNightAbility,
  projectNightAbility,
  abilityStatus,
} from "../../../../src/game/mechanisms/roles/abilities";
import {
  installNativeAbility,
  recordNightAbilityUse,
} from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  grantNightAbility,
  transferNightAbility,
} from "../../../../src/game/mechanisms/roles/ability_changes";
import { captureNightAbilityScope } from "../../../../src/game/mechanisms/roles/ability_scope";
function fixture() {
  const world = new World(),
    role = createRoleComponent(Role.AwakenedSeer, Camp.Good),
    actorId = world.createEntity(),
    targetId = world.createEntity(),
    events: GameEvent[] = [];
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Alive, createAliveComponent());
  world.addComponent(targetId, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  world.addComponent(targetId, COMPONENT.Alive, createAliveComponent());
  const input = freshPairSeerState(),
    state = installNativeAbility(role, "pair_check", input),
    ability = findNightAbility(role, "pair_check")!;
  return { world, role, actorId, targetId, input, state, ability, events };
}
test("native pair resource and projection have no ordinary Seer state or single target result", () => {
  const f = fixture();
  expect(f.state).not.toBe(f.input);
  expect(f.ability.state).toBe(f.state);
  expect(findNightAbility(f.role, "seer_check")).toBeUndefined();
  const dto = projectNightAbility(f.ability, 1);
  expect(dto.kind).toBe("pair_check");
  expect(dto.state).toEqual(freshPairSeerState());
  expect(dto.state).not.toBe(f.state);
  expect(dto).toMatchObject({
    source: { kind: "native", role: "awakened_seer" },
    uses: 0,
    status: "active",
  });
  recordNightAbilityUse(f.ability, 1, true);
  expect(f.ability.uses).toBe(1);
  expect(abilityStatus(f.ability, 1)).toBe("used_this_night");
  expect(abilityStatus(f.ability, 2)).toBe("active");
});
test("pair scope revokes replaced native state, edited policy or first death and revival", () => {
  for (const action of ["state", "policy", "life"] as const) {
    const f = fixture(),
      scope = captureNightAbilityScope(f.world, f.actorId, f.ability, 1, () => true)!;
    expect(scope.isEligible()).toBe(true);
    if (action === "state") installNativeAbility(f.role, "pair_check", freshPairSeerState());
    else if (action === "policy")
      Object.defineProperty(f.state, "policy", { value: "other", writable: true });
    else {
      const life = f.world.getComponent(f.actorId, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    expect(scope.isEligible()).toBe(false);
  }
});
test("gift, copy and transfer cannot broaden the finite pair capability or mutate its original resource", () => {
  const f = fixture(),
    before = structuredClone(f.ability);
  for (const source of [
    { kind: "gift" as const, actorId: 1 },
    { kind: "copy" as const, actorId: 1, abilityId: "native:pair_check" },
  ])
    expect(() =>
      grantNightAbility(
        f.world,
        f.targetId,
        {
          id: "gift:pair",
          kind: "pair_check",
          state: freshPairSeerState(),
          source,
          startsOnDay: 1,
          maxUses: null,
        },
        f.events,
      ),
    ).toThrow("ability_pair_native_only");
  let calls = 0;
  expect(() =>
    transferNightAbility(
      f.world,
      f.actorId,
      f.targetId,
      "native:pair_check",
      "transfer:pair",
      f.events,
      {
        kind: "pair_check",
        statePolicy: (s) => {
          calls++;
          return structuredClone(s);
        },
      },
    ),
  ).toThrow("ability_pair_native_only");
  expect(calls).toBe(0);
  expect(f.ability).toEqual(before);
  expect(f.events).toEqual([]);
  expect(
    findNightAbility(f.world.getComponent(f.targetId, COMPONENT.Role), "pair_check"),
  ).toBeUndefined();
});
test("invalid native pair state is rejected before creating a resource", () => {
  const role = createRoleComponent(Role.AwakenedSeer, Camp.Good);
  const malformed = { ...freshPairSeerState(), count: 1 };
  expect(() => installNativeAbility(role, "pair_check", malformed)).toThrow(
    "fragrant_pair_state_invalid",
  );
  expect(role.privateState).toEqual({});
});
test("native pair initialization rejects raw history getter before cloning can execute it", () => {
  const role = createRoleComponent(Role.AwakenedSeer, Camp.Good);
  let reads = 0;
  const state = {
    policy: "awa_fragrant_pair_seer_v1" as const,
    get history() {
      reads++;
      return [];
    },
  };
  expect(() => installNativeAbility(role, "pair_check", state)).toThrow(
    "fragrant_pair_state_invalid",
  );
  expect(reads).toBe(0);
  expect(role.privateState).toEqual({});
});
test("final grant installation rejects a kind changing to pair during input cloning", () => {
  const f = fixture();
  let reads = 0;
  const input = {
    id: "gift:smuggled",
    get kind(): "pair_check" {
      reads++;
      return (reads === 1 ? "guard" : "pair_check") as "pair_check";
    },
    state: freshPairSeerState(),
    source: { kind: "gift" as const, actorId: f.actorId },
    startsOnDay: 1,
    maxUses: null,
  };
  expect(() => grantNightAbility(f.world, f.targetId, input, f.events)).toThrow(
    "ability_pair_native_only",
  );
  expect(
    findNightAbility(f.world.getComponent(f.targetId, COMPONENT.Role), "pair_check"),
  ).toBeUndefined();
  expect(f.events).toEqual([]);
});
test("final transfer installation rejects callback-mutated pair without target install or event", () => {
  const f = fixture();
  installNativeAbility(f.role, "guard", { lastTarget: null });
  const guard = findNightAbility(f.role, "guard")!;
  expect(() =>
    transferNightAbility(f.world, f.actorId, f.targetId, guard.id, "transfer:changed", f.events, {
      kind: "guard",
      statePolicy: () => {
        Object.defineProperty(guard, "kind", { value: "pair_check", writable: true });
        Object.defineProperty(guard, "state", { value: freshPairSeerState(), writable: true });
        return { lastTarget: null };
      },
    }),
  ).toThrow("ability_pair_native_only");
  expect(
    findNightAbility(f.world.getComponent(f.targetId, COMPONENT.Role), "pair_check"),
  ).toBeUndefined();
  expect(f.events).toEqual([]);
});
