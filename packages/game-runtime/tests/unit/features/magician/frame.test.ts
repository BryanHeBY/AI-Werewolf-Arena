/**
 * 单元测试验证 magician 的独立 frame.test 契约。输入为既有内存 fixture、原回调控制和明确非法
 * 修改；原字面预期、身份快照及拒绝断言是预期，不在迁移中重新生成。仅调用原生内存
 * owner／frame／reader，测试自有 mock／组件不运行完整对局、模型或真实传输，support／fixture 字节及政策状态不变。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { COMPONENT, Camp, type World, type RoleComponent } from "../../../../src/domain";

import { createMagicianState } from "../../../../src/features/magician/state-slot";
import {
  installMagicianBoard,
  abortMagicianNight,
  beginMagicianNight,
  closeMagicianNight,
  commitMagicianExchange,
  magicianChoiceTargets,
  resolveMagicianNightTarget,
} from "../../../../src/features/magician/night-frame";
function fixture(
  firstNight: 1 | 2 = 1,
  shot: "original" | "exchanged" = "original",
  alterLife?: (life: ReturnType<typeof createAliveComponent>) => void,
) {
  const state = createMagicianState(firstNight, shot);
  const roles = new Map<number, RoleComponent>([
    [
      1,
      {
        role: "magician",
        privateState: { magician: state },
      } as unknown as RoleComponent,
    ],
    ...[2, 3, 4].map(
      (id) => [id, { role: "villager", privateState: {} } as RoleComponent] as const,
    ),
  ]);
  // 独立实际Camp组件输入；Role只保角色和原privateState，名单历史仍按原时点捕获。
  const camps = new Map([...roles.keys()].map((id) => [id, { camp: Camp.Good }]));
  const lives = new Map([...roles.keys()].map((id) => [id, createAliveComponent()]));
  const identities = new Map(
    [...roles.keys()].map((id) => [
      id,
      { id, seat: id, name: "Player " + id, sessionId: "player_" + id },
    ]),
  );
  const world = {
    entityIds: () => [...roles.keys()],
    getComponent: (id: number, kind: unknown) =>
      kind === COMPONENT.Camp
        ? camps.get(id)
        : kind === COMPONENT.Role
          ? roles.get(id)
          : kind === COMPONENT.Alive
            ? lives.get(id)
            : kind === COMPONENT.Identity
              ? identities.get(id)
              : undefined,
  } as unknown as World;
  if (alterLife) alterLife(lives.get(1)!);
  installMagicianBoard(world);
  return { world, roles, lives, identities, state };
}
test("Magician commits one-use bidirectional mapping and closes its exact night", () => {
  const f = fixture();
  expect(beginMagicianNight(f.world, 1)).toBe(1);
  expect(magicianChoiceTargets(f.world, 1)).toEqual([1, 2, 3, 4]);
  expect(() => resolveMagicianNightTarget(f.world, 1, 2)).toThrow("magician_night_unsettled");
  commitMagicianExchange(f.world, 1, 1, [3, 2]);
  expect(f.state.history).toEqual([{ day: 1, pair: [2, 3] }]);
  const token = resolveMagicianNightTarget(f.world, 1, 2);
  expect([token.requestedId, token.effectiveId]).toEqual([2, 3]);
  expect(token.isCurrent()).toBe(true);
  expect(resolveMagicianNightTarget(f.world, 1, 3).effectiveId).toBe(2);
  expect(resolveMagicianNightTarget(f.world, 1, 4).effectiveId).toBe(4);
  expect(() => commitMagicianExchange(f.world, 1, 1, null)).toThrow();
  closeMagicianNight(f.world, 1);
  expect(token.isCurrent()).toBe(false);
  expect(() => resolveMagicianNightTarget(f.world, 1, 2)).toThrow();
  expect(beginMagicianNight(f.world, 2)).toBe(1);
  expect(magicianChoiceTargets(f.world, 2)).toEqual([1, 4]);
  expect(() => commitMagicianExchange(f.world, 1, 2, [1, 2])).toThrow();
  commitMagicianExchange(f.world, 1, 2, [1, 4]);
  closeMagicianNight(f.world, 2);
  expect(beginMagicianNight(f.world, 3)).toBeNull();
  expect(resolveMagicianNightTarget(f.world, 3, 2).effectiveId).toBe(2);
});
test("Magician activation policy and explicit pass consume no seats", () => {
  const f = fixture(2);
  expect(beginMagicianNight(f.world, 1)).toBeNull();
  expect(() => commitMagicianExchange(f.world, 1, 1, [1, 2])).toThrow();
  closeMagicianNight(f.world, 1);
  expect(beginMagicianNight(f.world, 2)).toBe(1);
  commitMagicianExchange(f.world, 1, 2, null);
  expect(f.state.history).toEqual([{ day: 2, pair: null }]);
  closeMagicianNight(f.world, 2);
  expect(beginMagicianNight(f.world, 3)).toBe(1);
  expect(magicianChoiceTargets(f.world, 3)).toEqual([1, 2, 3, 4]);
});
for (const shot of ["original", "exchanged"] as const)
  test("Magician death-shot mapping is explicit/" + shot, () => {
    const f = fixture(1, shot);
    beginMagicianNight(f.world, 1);
    commitMagicianExchange(f.world, 1, 1, [2, 3]);
    expect(resolveMagicianNightTarget(f.world, 1, 2, "death_shot").effectiveId).toBe(
      shot === "exchanged" ? 3 : 2,
    );
    f.lives.get(3)!.alive = false;
    expect(() => resolveMagicianNightTarget(f.world, 1, 2)).toThrow("magician_target_invalid");
    const token = resolveMagicianNightTarget(f.world, 1, 2, "death_shot");
    expect(token.scope.life.alive).toBe(shot === "original");
    expect(token.isCurrent()).toBe(true);
  });
test("Magician committed effect survives caster death but never revival or replacement", () => {
  const f = fixture();
  beginMagicianNight(f.world, 1);
  commitMagicianExchange(f.world, 1, 1, [2, 3]);
  f.lives.get(1)!.alive = false;
  expect(resolveMagicianNightTarget(f.world, 1, 2).effectiveId).toBe(3);
  f.lives.get(1)!.alive = true;
  expect(() => resolveMagicianNightTarget(f.world, 1, 2)).toThrow(
    "magician_original_state_revoked",
  );
  const g = fixture();
  beginMagicianNight(g.world, 1);
  commitMagicianExchange(g.world, 1, 1, [2, 3]);
  const token = resolveMagicianNightTarget(g.world, 1, 2);
  g.lives.set(3, createAliveComponent());
  expect(token.isCurrent()).toBe(false);
  expect(() => resolveMagicianNightTarget(g.world, 1, 2)).toThrow(
    "magician_original_state_revoked",
  );
});
test("Magician refuses history edits, identity replacement and malformed choices", () => {
  const f = fixture();
  beginMagicianNight(f.world, 1);
  expect(() => commitMagicianExchange(f.world, 1, 1, [2, 2])).toThrow();
  let reads = 0;
  const pair = [] as unknown as [number, number];
  Object.defineProperty(pair, "0", {
    get() {
      reads++;
      throw new Error("must_not_read");
    },
  });
  Object.defineProperty(pair, "1", { value: 3 });
  expect(() => commitMagicianExchange(f.world, 1, 1, pair)).toThrow();
  expect(reads).toBe(0);
  f.state.history.push({ day: 1, pair: [2, 3] });
  expect(() => commitMagicianExchange(f.world, 1, 1, null)).toThrow(
    "magician_original_state_revoked",
  );
  const g = fixture();
  beginMagicianNight(g.world, 1);
  g.identities.set(2, { ...g.identities.get(2)! });
  expect(() => commitMagicianExchange(g.world, 1, 1, [2, 3])).toThrow(
    "magician_original_state_revoked",
  );
});

test("Magician installation never invokes a replaced Alive accessor", () => {
  let reads = 0;
  expect(() =>
    fixture(1, "original", (life) =>
      Object.defineProperty(life, "alive", {
        get() {
          reads++;
          throw new Error("must_not_execute");
        },
      }),
    ),
  ).toThrow("magician_original_roster_invalid");
  expect(reads).toBe(0);
});

test("Magician rejects in-place seat mutation and revokes pending choice on cleanup", () => {
  const f = fixture();
  beginMagicianNight(f.world, 1);
  f.identities.get(2)!.seat = 3;
  expect(() => commitMagicianExchange(f.world, 1, 1, [2, 3])).toThrow(
    "magician_original_state_revoked",
  );
  expect(() => abortMagicianNight(f.world)).not.toThrow();
  const g = fixture();
  beginMagicianNight(g.world, 1);
  abortMagicianNight(g.world);
  expect(() => commitMagicianExchange(g.world, 1, 1, null)).toThrow(
    "magician_choice_scope_invalid",
  );
  expect(g.state.history).toEqual([]);
});

test("Magician pending token survives caster death and rejects target revival", () => {
  const f = fixture();
  beginMagicianNight(f.world, 1);
  commitMagicianExchange(f.world, 1, 1, [2, 3]);
  const token = resolveMagicianNightTarget(f.world, 1, 2);
  expect(token.isCurrent()).toBe(true);
  f.lives.get(1)!.alive = false;
  expect(token.isCurrent()).toBe(true);
  f.lives.get(3)!.alive = false;
  f.lives.get(3)!.alive = true;
  expect(token.isCurrent()).toBe(false);
  expect(() => resolveMagicianNightTarget(f.world, 1, 2)).toThrow(
    "magician_original_state_revoked",
  );
});
for (const id of [1, 3]) {
  test("Magician pending token rejects a replaced Alive accessor without reading it/" + id, () => {
    const f = fixture();
    beginMagicianNight(f.world, 1);
    commitMagicianExchange(f.world, 1, 1, [2, 3]);
    const token = resolveMagicianNightTarget(f.world, 1, 2);
    let reads = 0;
    Object.defineProperty(f.lives.get(id)!, "alive", {
      get() {
        reads++;
        throw new Error("must_not_execute");
      },
    });
    expect(token.isCurrent()).toBe(false);
    expect(() => resolveMagicianNightTarget(f.world, 1, 2)).toThrow(
      "magician_original_state_revoked",
    );
    expect(reads).toBe(0);
  });
}
