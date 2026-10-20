/**
 * 单元测试负责觉醒日间双角色唯一状态writer及真实夜前原体绑定反例。输入品牌工厂／伪clone／旧前缀和阶段对象，
 * 字面预期禁止回滚已付库存、编辑旧目标、批量跨付款及首白天前重新mint同号新生命；不运行模型。
 */
import { expect, test } from "bun:test";
import { Role, Camp } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import {
  initializeAwakenedGuardState,
  getAwakenedGuardState,
  prepareGuardCycles,
  replaceGuardState,
} from "../../../../src/features/awakened-guard/state";
import {
  initializeAwakenedKnightState,
  getAwakenedKnightState,
  prepareDuelAttempts,
  replaceKnightState,
} from "../../../../src/features/awakened-knight/state";
import { AWAKENED_KNIGHT_PREPARE_STAGE } from "../../../../src/features/awakened-knight/night-stage";
import {
  AWAKENED_GUARD_PREPARE_STAGE,
  AWAKENED_GUARD_NIGHT_STAGE,
} from "../../../../src/features/awakened-guard/night-stage";
import { openDuelBoundary } from "../../../../src/features/awakened-knight/authority";
import {
  createNightStageState,
  type TrustedNightStageRuntime,
} from "../../../../src/engine/night/trusted-runtime";
function fixture(kind: Role.AwakenedGuard | Role.AwakenedKnight) {
  const world = new World("en"),
    id = world.createEntity(),
    role = createRoleComponent(kind),
    life = createAliveComponent();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Alive, life);
  world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
  if (kind === Role.AwakenedGuard) initializeAwakenedGuardState(role, world);
  else initializeAwakenedKnightState(role, world);
  return { world, role, life };
}
test("Knight writer只追加一条不可变品牌attempt，原前缀不可清空、改分支或批量推进", () => {
  const f = fixture(Role.AwakenedKnight),
    empty = getAwakenedKnightState(f.role)!,
    first = prepareDuelAttempts([{ day: 1, chain: 1, targetId: 2, branch: "wolf" }]);
  replaceKnightState(f.world, f.role, empty, first);
  for (const bad of [
    prepareDuelAttempts([]),
    prepareDuelAttempts([
      { day: 1, chain: 1, targetId: 2, branch: "good" },
      { day: 1, chain: 2, targetId: 3, branch: "wolf" },
    ]),
    prepareDuelAttempts([
      ...first.attempts,
      { day: 1, chain: 1, targetId: 3, branch: "wolf" },
      { day: 1, chain: 1, targetId: 4, branch: "wolf" },
    ]),
  ])
    expect(() => replaceKnightState(f.world, f.role, first, bad)).toThrow(
      "awakened_knight_transition_invalid",
    );
  expect(() => replaceKnightState(f.world, f.role, first, structuredClone(first))).toThrow(
    "awakened_knight_state_revoked",
  );
  expect(() => {
    (first.attempts as unknown[]).push({});
  }).toThrow();
  expect(getAwakenedKnightState(f.role)).toBe(first);
  expect(first.attempts).toEqual([{ day: 1, chain: 1, targetId: 2, branch: "wolf" }]);
});
test("Guard writer只能append下一open或结算原末open，已付目标和历史不可回滚／clone接管", () => {
  const f = fixture(Role.AwakenedGuard),
    empty = getAwakenedGuardState(f.role)!,
    open = prepareGuardCycles([{ day: 1, status: "open" }]),
    paid = prepareGuardCycles([{ day: 1, status: "protected", targetId: 2, timing: "night" }]);
  replaceGuardState(f.world, f.role, empty, open);
  expect(() => prepareGuardCycles([{ day: 2, status: "passed" }])).toThrow(
    "awakened_guard_history_invalid",
  );
  replaceGuardState(f.world, f.role, open, paid);
  for (const bad of [
    prepareGuardCycles([]),
    prepareGuardCycles([{ day: 1, status: "protected", targetId: 3, timing: "night" }]),
    prepareGuardCycles([
      { day: 1, status: "passed" },
      { day: 2, status: "open" },
    ]),
    prepareGuardCycles([
      { day: 1, status: "protected", targetId: 2, timing: "night" },
      { day: 2, status: "unused" },
    ]),
  ])
    expect(() => replaceGuardState(f.world, f.role, paid, bad)).toThrow(
      "awakened_guard_transition_invalid",
    );
  expect(() => replaceGuardState(f.world, f.role, paid, structuredClone(paid))).toThrow(
    "awakened_guard_state_revoked",
  );
  expect(() => {
    (paid.cycles[0] as { targetId: number }).targetId = 3;
  }).toThrow();
  expect(getAwakenedGuardState(f.role)).toBe(paid);
  expect(paid.cycles).toEqual([{ day: 1, status: "protected", targetId: 2, timing: "night" }]);
});
for (const kind of [Role.AwakenedGuard, Role.AwakenedKnight] as const)
  for (const mode of ["replace", "revive"] as const)
    test(`${kind}真实N1无请求prepare已绑旧体，首窗口前${mode}零新请求／付款`, async () => {
      const f = fixture(kind),
        events: unknown[] = [],
        state = createNightStageState();
      let requests = 0;
      const ctx = {
        world: f.world,
        events,
        state,
        currentDay: () => 1,
        isCurrent: () => true,
        getAliveByRole: (role: Role) =>
          f.world
            .getAliveEntityIds()
            .filter((id) => f.world.getComponent(id, COMPONENT.Role)?.role === role),
        actionProvider: {
          async getAction() {
            requests++;
            throw new Error("literal_no_request");
          },
        },
      } as unknown as TrustedNightStageRuntime;
      await (
        kind === Role.AwakenedGuard ? AWAKENED_GUARD_PREPARE_STAGE : AWAKENED_KNIGHT_PREPARE_STAGE
      ).execute(ctx);
      if (mode === "replace") f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
      else {
        f.life.alive = false;
        f.life.alive = true;
      }
      if (kind === Role.AwakenedGuard) {
        await expect(AWAKENED_GUARD_NIGHT_STAGE.execute(ctx)).rejects.toThrow(
          "awakened_guard_night_boundary_missing",
        );
        expect(getAwakenedGuardState(f.role)!.cycles).toEqual([{ day: 1, status: "open" }]);
      } else {
        expect(openDuelBoundary(f.world, 1, 1, {})).toBeNull();
        expect(getAwakenedKnightState(f.role)!.attempts).toEqual([]);
      }
      expect(requests).toBe(0);
    });
