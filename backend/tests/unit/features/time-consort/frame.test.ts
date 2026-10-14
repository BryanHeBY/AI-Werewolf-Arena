/**
 * 单元测试验证 time-consort 的独立 frame.test 契约。输入为既有内存 fixture、原回调控制和明确非法
 * 修改；原字面预期、身份快照及拒绝断言是预期，不在迁移中重新生成。仅调用原生内存
 * owner／frame／reader，测试自有 mock／组件不运行完整对局、模型或真实传输，support／fixture 字节及政策状态不变。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import type { ReflectionScope } from "@ai-werewolf-arena/game-contract";
import { expect, test } from "bun:test";
import { COMPONENT, Camp, type RoleComponent, type World } from "../../../../src/core";

import { createTimeConsortState } from "../../../../src/game/mechanisms/roles/time_wolf_consort/state-slot";
import {
  installTimeConsortBoard,
  beginTimeConsortNight,
  commitTimeConsortChoice,
  resolveTimeConsortTarget,
  closeTimeConsortNight,
  abortTimeConsortNight,
  timeConsortChoiceTargets,
} from "../../../../src/game/mechanisms/roles/time_wolf_consort/night_frame";
function fixture(scope: ReflectionScope = "whole_night") {
  const state = createTimeConsortState(scope);
  const names = ["time_wolf_consort", "guard", "witch", "seer", "villager", "wolf", "order_prince"];
  const roles = new Map(
    names.map((role, i) => [
      i + 1,
      {
        role,
        camp: i === 0 || i === 5 ? Camp.Wolf : Camp.Good,
        privateState: i === 0 ? { timeConsort: state } : {},
      } as unknown as RoleComponent,
    ]),
  );
  const lives = new Map([...roles.keys()].map((id) => [id, createAliveComponent()]));
  const identities = new Map(
    [...roles.keys()].map((id) => [
      id,
      { id, seat: id, name: "Player " + id, sessionId: "p" + id },
    ]),
  );
  const world = {
    entityIds: () => [...roles.keys()],
    getComponent: (id: number, kind: unknown) =>
      kind === COMPONENT.Role
        ? roles.get(id)
        : kind === COMPONENT.Alive
          ? lives.get(id)
          : kind === COMPONENT.Identity
            ? identities.get(id)
            : undefined,
  } as unknown as World;
  installTimeConsortBoard(world);
  return { world, state, roles, lives, identities };
}
for (const mode of ["whole_night", "first_effect"] as const)
  test("Consort authoritative reflection receipt/" + mode, () => {
    const f = fixture(mode);
    beginTimeConsortNight(f.world, 1);
    expect(() => resolveTimeConsortTarget(f.world, 1, 2, 5, "guard")).toThrow(
      "time_consort_night_unsettled",
    );
    commitTimeConsortChoice(f.world, 1, 1, 5);
    expect(f.state.triggeredDay).toBeNull();
    const guard = resolveTimeConsortTarget(f.world, 1, 2, 5, "guard");
    expect(guard.reflected).toBe(true);
    expect(guard.effectiveId).toBe(2);
    expect(guard.isCurrent()).toBe(true);
    guard.commit();
    expect(f.state.triggeredDay).toBe(1);
    expect(guard.isCurrent()).toBe(false);
    expect(() => guard.commit()).toThrow();
    const poison = resolveTimeConsortTarget(f.world, 1, 3, 5, "poison");
    expect(poison.reflected).toBe(mode === "whole_night");
    expect(poison.effectiveId).toBe(mode === "whole_night" ? 3 : 5);
    poison.commit();
    const check = resolveTimeConsortTarget(f.world, 1, 4, 5, "check");
    expect(check.reflected).toBe(mode === "whole_night");
    check.commit();
    closeTimeConsortNight(f.world, 1);
    expect(beginTimeConsortNight(f.world, 2)).toBeNull();
    expect(timeConsortChoiceTargets(f.world, 2)).toEqual([]);
  });
test("Consort non-reflectable or other-target effects never consume the charge", () => {
  const f = fixture();
  beginTimeConsortNight(f.world, 1);
  commitTimeConsortChoice(f.world, 1, 1, 5);
  for (const [source, target, kind] of [
    [3, 5, "heal"],
    [6, 5, "kill"],
    [4, 7, "check"],
  ] as const) {
    const token = resolveTimeConsortTarget(f.world, 1, source, target, kind);
    expect(token.reflected).toBe(false);
    expect(token.effectiveId).toBe(target);
    token.commit();
    expect(f.state.triggeredDay).toBeNull();
  }
  closeTimeConsortNight(f.world, 1);
  expect(beginTimeConsortNight(f.world, 2)).toBe(1);
  expect(timeConsortChoiceTargets(f.world, 2)).not.toContain(5);
  expect(() => commitTimeConsortChoice(f.world, 1, 2, 5)).toThrow();
  expect(f.state.history).toHaveLength(1);
  commitTimeConsortChoice(f.world, 1, 2, null);
  closeTimeConsortNight(f.world, 2);
  beginTimeConsortNight(f.world, 3);
  expect(timeConsortChoiceTargets(f.world, 3)).toContain(5);
});
test("Consort self-targeted effect counts as a reflection even without changing target", () => {
  const f = fixture();
  beginTimeConsortNight(f.world, 1);
  commitTimeConsortChoice(f.world, 1, 1, 2);
  const token = resolveTimeConsortTarget(f.world, 1, 2, 2, "guard");
  expect(token.reflected).toBe(true);
  expect(token.effectiveId).toBe(2);
  token.commit();
  expect(f.state.triggeredDay).toBe(1);
});
test("Consort committed block survives ordinary death but never resurrection", () => {
  const f = fixture();
  beginTimeConsortNight(f.world, 1);
  commitTimeConsortChoice(f.world, 1, 1, 5);
  const token = resolveTimeConsortTarget(f.world, 1, 4, 5, "check");
  f.lives.get(1)!.alive = false;
  expect(token.isCurrent()).toBe(true);
  f.lives.get(1)!.alive = true;
  expect(token.isCurrent()).toBe(false);
  expect(() => token.commit()).toThrow();
  expect(f.state.triggeredDay).toBeNull();
});
test("Consort pending receipts reject history, life, identity, cancellation and prior effects", () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.state.history[0]!.targetId = 4;
    },
    (f: ReturnType<typeof fixture>) => {
      f.lives.get(4)!.alive = false;
    },
    (f: ReturnType<typeof fixture>) => {
      f.lives.set(5, createAliveComponent());
    },
    (f: ReturnType<typeof fixture>) => {
      f.identities.get(5)!.seat = 99;
    },
    (f: ReturnType<typeof fixture>) => {
      abortTimeConsortNight(f.world);
    },
    (f: ReturnType<typeof fixture>) => {
      resolveTimeConsortTarget(f.world, 1, 2, 5, "guard").commit();
    },
  ]) {
    const f = fixture();
    beginTimeConsortNight(f.world, 1);
    commitTimeConsortChoice(f.world, 1, 1, 5);
    const token = resolveTimeConsortTarget(f.world, 1, 4, 5, "check");
    mutate(f);
    expect(token.isCurrent()).toBe(false);
    expect(() => token.commit()).toThrow();
  }
});
