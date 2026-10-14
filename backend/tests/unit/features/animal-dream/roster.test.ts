/**
 * 单元测试验证 animal-dream 的独立 roster.test 契约。输入为既有内存 fixture、原回调控制和明确非法
 * 修改；原字面预期、身份快照及拒绝断言是预期，不在迁移中重新生成。仅调用原生内存
 * owner／frame／reader，测试自有 mock／组件不运行完整对局、模型或真实传输，support／fixture 字节及政策状态不变。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { Camp, Role } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";

import type { CampComponent } from "../../../../src/core/domain/components/camp";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import type { IdentityComponent } from "../../../../src/core/domain/entities/player";
import {
  animalRosterFixture,
  animalInternalConfig,
} from "../../../support/features/animal-dream/builders/roster";
import {
  installAnimalRoster,
  animalRosterCurrent,
  animalOriginalPlayer,
  animalOriginalRolePlayer,
  animalRosterPolicies,
} from "../../../../src/game/mechanisms/roles/animal_dream/roster";
test("complete original Animal roster holds policy values without public activation", () => {
  const f = animalRosterFixture();
  expect(animalRosterCurrent(f.world)).toBe(true);
  expect(animalOriginalRolePlayer(f.world, "white_cat")?.scope.id).toBe(9);
  expect(animalOriginalRolePlayer(f.world, "fox_cub")?.scope.id).toBe(10);
  expect(animalOriginalRolePlayer(f.world, "pufferfish")?.scope.id).toBe(12);
  expect(animalOriginalRolePlayer(f.world, "wolf")).toBeNull();
  f.config.whiteCat.skippedVotePolicy = "awa_expire_on_skipped_day_v1";
  expect(animalRosterPolicies(f.world)).toEqual({
    skippedVotePolicy: "awa_wait_for_actual_exile_v1",
    ballotPolicy: "awa_final_ballot_v1",
  });
  expect(() => installAnimalRoster(f.world, animalInternalConfig())).toThrow(
    "animal_roster_already_installed",
  );
});
test("real first death retains original relation identity; revival does not", () => {
  const f = animalRosterFixture();
  f.life(12).alive = false;
  expect(animalRosterCurrent(f.world)).toBe(true);
  expect(animalOriginalPlayer(f.world, 12)).toBeNull();
  expect(animalOriginalPlayer(f.world, 12, false)?.scope.life).toBe(f.life(12));
  f.life(12).alive = true;
  expect(animalRosterCurrent(f.world)).toBe(false);
});
test("observed Camp drift is terminal after restoration", () => {
  const f = animalRosterFixture(),
    camp = f.world.getComponent(10, COMPONENT.Camp)!;
  camp.camp = Camp.Wolf;
  expect(animalRosterCurrent(f.world)).toBe(false);
  camp.camp = Camp.Good;
  expect(animalRosterCurrent(f.world)).toBe(false);
  expect(animalOriginalRolePlayer(f.world, "fox_cub")).toBeNull();
});
test("replacement body cannot revive roster ownership", () => {
  const f = animalRosterFixture(),
    original = f.life(9);
  f.world.addComponent(9, COMPONENT.Alive, createAliveComponent());
  expect(animalRosterCurrent(f.world)).toBe(false);
  f.world.addComponent(9, COMPONENT.Alive, original);
  expect(animalRosterCurrent(f.world)).toBe(false);
});
test("Identity metadata mutation revokes, ordinary private JSON state updates do not", () => {
  const f = animalRosterFixture();
  (f.role(11).privateState as Record<string, unknown>).bear = {
    history: [{ day: 1, roared: false }],
  };
  expect(animalRosterCurrent(f.world)).toBe(true);
  f.world.getComponent(11, COMPONENT.Identity)!.name = "changed";
  expect(animalRosterCurrent(f.world)).toBe(false);
});
const invalid: Record<string, (w: ReturnType<typeof animalRosterFixture>["world"]) => void> = {
  "unsupported actual role": (w) => {
    w.getComponent(10, COMPONENT.Role)!.role = Role.Seer;
  },
  "wrong actual Fox camp": (w) => {
    w.getComponent(10, COMPONENT.Camp)!.camp = Camp.Wolf;
    w.getComponent(10, COMPONENT.Camp)!.camp = Camp.Wolf;
  },
  "shared life": (w) => {
    w.addComponent(6, COMPONENT.Alive, w.getComponent(5, COMPONENT.Alive)!);
  },
  // 错槽别名本身是被测非法样本；类型断言不复制对象或纠正存储内容。
  "Role and Camp alias": (w) => {
    w.addComponent(10, COMPONENT.Camp, w.getComponent(10, COMPONENT.Role) as unknown as import("../../../../src/core/domain/component-map").ComponentWrite<typeof COMPONENT.Camp>);
  },
  "shared private container": (w) => {
    (
      w.getComponent(6, COMPONENT.Role)! as {
        privateState: object;
      }
    ).privateState = w.getComponent(5, COMPONENT.Role)!.privateState;
  },
  "duplicate seat": (w) => {
    w.getComponent(6, COMPONENT.Identity)!.seat = 5;
  },
  "duplicate session": (w) => {
    w.getComponent(6, COMPONENT.Identity)!.sessionId = "player_5";
  },
  "wrong victory": (w) => {
    w.addComponent(1, COMPONENT.Victory, {
      affiliations: [{ kind: "faction", faction: Camp.Good }],
    });
  },
};
for (const [label, mutate] of Object.entries(invalid))
  test(`reject ${label} before roster installation`, () =>
    expect(() => animalRosterFixture(mutate)).toThrow("animal_initial_roster_invalid"));
test("invalid private accessors are rejected without executing them", () => {
  let calls = 0;
  expect(() =>
    animalRosterFixture((w) => {
      Object.defineProperty(w.getComponent(9, COMPONENT.Role)!, "privateState", {
        enumerable: true,
        get() {
          calls++;
          return {};
        },
      });
    }),
  ).toThrow();
  expect(calls).toBe(0);
});
test("late private accessors revoke without invoking or replacing original inventory", () => {
  const f = animalRosterFixture();
  let calls = 0;
  Object.defineProperty(f.role(10).privateState, "foxCub", {
    enumerable: true,
    get() {
      calls++;
      return {};
    },
  });
  expect(animalRosterCurrent(f.world)).toBe(false);
  expect(calls).toBe(0);
});
