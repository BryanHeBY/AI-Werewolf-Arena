/**
 * 单元测试：验证清边优先级与非法政策不会改变无关判胜规则。输入为明确存活名单及优先级；手写结果对象检查独立次序，不从生产判胜器反推预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import type { AliveComponent } from "../../../src/domain/components/alive";
import type { RoleComponent } from "../../../src/domain/components/role";
import { Camp, Role, WinCondition } from "../../../src/domain/identity";
import { ELIMINATION_PRIORITIES, type EliminationPriority } from "../../../src/domain/board";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import {
  createEliminationWinConditionSpecs,
  DEFAULT_WIN_CONDITION_SPECS,
} from "../../../src/rulesets/victory/default-specs";
import {
  WinConditionRegistry,
  getDefaultWinConditionRegistry,
} from "../../../src/engine/victory/condition-registry";

const cases = [
  { name: "no goal", dead: [], side: [null, null], city: [null, null] },
  {
    name: "wolves eliminated",
    dead: [Role.Wolf],
    side: [Camp.Good, Camp.Good],
    city: [Camp.Good, Camp.Good],
  },
  {
    name: "gods eliminated",
    dead: [Role.Seer, Role.Witch],
    side: [Camp.Wolf, Camp.Wolf],
    city: [null, null],
  },
  {
    name: "villagers eliminated",
    dead: [Role.Villager],
    side: [Camp.Wolf, Camp.Wolf],
    city: [null, null],
  },
  {
    name: "last wolf and last god",
    dead: [Role.Wolf, Role.Seer, Role.Witch],
    side: [Camp.Good, Camp.Wolf],
    city: [Camp.Good, Camp.Good],
  },
  {
    name: "last wolf and last villager",
    dead: [Role.Wolf, Role.Villager],
    side: [Camp.Good, Camp.Wolf],
    city: [Camp.Good, Camp.Good],
  },
  {
    name: "all good eliminated",
    dead: [Role.Seer, Role.Witch, Role.Villager],
    side: [Camp.Wolf, Camp.Wolf],
    city: [Camp.Wolf, Camp.Wolf],
  },
  {
    name: "everyone eliminated",
    dead: [Role.Wolf, Role.Seer, Role.Witch, Role.Villager],
    side: [Camp.Good, Camp.Wolf],
    city: [Camp.Good, Camp.Wolf],
  },
] as const;

for (const locale of ["zh-CN", "en"] as const) {
  for (const scenario of cases) {
    for (const [index, priority] of ELIMINATION_PRIORITIES.entries()) {
      test(`${locale}/${priority}/${scenario.name}: explicit elimination priority has a handwritten result`, () => {
        const { world } = bootstrapGame(
          {
            ...sixPlayerMvpConfig,
            roleSetups: [
              { role: Role.Wolf, count: 2 },
              { role: Role.Villager, count: 2 },
              { role: Role.Seer, count: 1 },
              { role: Role.Witch, count: 1 },
            ],
          },
          { locale },
        );
        const members = new Map(
          world.entityIds().map((id) => [id, world.getComponent(id, COMPONENT.Role)!]),
        );
        for (const [id, role] of members) {
          if ((scenario.dead as readonly Role[]).includes(role.role)) {
            world.getComponent(id, COMPONENT.Alive)!.alive = false;
          }
        }
        const registry = new WinConditionRegistry(createEliminationWinConditionSpecs(priority));
        for (const [condition, expected] of [
          [WinCondition.SlaughterSide, scenario.side[index]],
          [WinCondition.SlaughterCity, scenario.city[index]],
        ] as const) {
          const decision = registry.evaluate(world, condition);
          expect(decision?.winner ?? null).toBe(expected);
          if (expected === null) {
            expect(decision).toBeNull();
          } else {
            expect(decision?.outcome).toMatchObject({
              winningPlayerIds: [...members]
                .filter(([id]) => world.getComponent(id, COMPONENT.Camp)!.camp === expected)
                .map(([id]) => id)
                .sort((a, b) => a - b),
            });
          }
        }
        // 配置过的 registry 不能改变共享的旧默认值。
        expect(
          getDefaultWinConditionRegistry().evaluate(world, WinCondition.SlaughterSide)?.winner ??
            null,
        ).toBe(scenario.side[0]);
        expect(
          getDefaultWinConditionRegistry().evaluate(world, WinCondition.SlaughterCity)?.winner ??
            null,
        ).toBe(scenario.city[0]);
      });
    }
  }
}

test("priority creation rejects unknown values and preserves unrelated victory specifications", () => {
  expect(() => createEliminationWinConditionSpecs("wolf" as EliminationPriority)).toThrow(
    "elimination_priority_invalid",
  );
  for (const priority of ELIMINATION_PRIORITIES) {
    const configured = createEliminationWinConditionSpecs(priority);
    expect(configured.map((spec) => spec.id)).toEqual(
      DEFAULT_WIN_CONDITION_SPECS.map((spec) => spec.id),
    );
    for (const id of [WinCondition.ThreeFactionsElimination, WinCondition.WolfReachHalf]) {
      expect(configured.find((spec) => spec.id === id)).toBe(
        DEFAULT_WIN_CONDITION_SPECS.find((spec) => spec.id === id),
      );
    }
  }
});
