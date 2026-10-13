/**
 * 单元测试：验证伤害计划查询与结算修改的边界。输入为原生命声明与字面量印记状态，
 * 独立预期检查折叠不消费印记／生命、折叠失败不清理、后续查询失败保留先前修改。
 * 取消命令的部分失败还需保留第一项已提交移除；不从生产输出推导预期。
 * 本模块不调用模型、传输或完整对局驱动。
 */
import { createAliveComponent } from "../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";

import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { StatusMark } from "../../../src/core/domain/identity";
import { captureNightLife } from "../../../src/core/domain/night_effects";
import { planNightDamage } from "../../../src/core/domain/night-damage-plan";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";

function fixture() {
  const world = new World();
  const ids = [world.createEntity(), world.createEntity()];
  const marks = ids.map((id) => {
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    const component = new StatusMarksComponent([StatusMark.WolfKillMark]);
    world.addComponent(id, COMPONENT.StatusMarks, component);
    return component;
  });
  return { world, ids, marks };
}

test("folding a paid shield queries its original receiver without consuming marks or lives", () => {
  const { world, ids, marks } = fixture();
  const target = captureNightLife(world, ids[0]!)!;
  const effect = {
    actorId: ids[1]!,
    target,
    isCurrent() {
      expect(this).toBe(effect);
      return true;
    },
  };
  const plan = planNightDamage(world, {
    mechanicalEffects: { shields: [effect], attacks: [], failures: [] },
  });
  expect([...plan.mechanical.shields]).toEqual([ids[0]!]);
  expect(world.getComponent(ids[0]!, COMPONENT.Alive)).toBe(target.life);
  expect(target.life.alive).toBe(true);
  expect(marks.map((mark) => mark.values())).toEqual([
    [StatusMark.WolfKillMark],
    [StatusMark.WolfKillMark],
  ]);
});

test("a fold failure preserves every original mark before entity resolution begins", () => {
  const { world, ids, marks } = fixture();
  const failure = Error("paid_owner_query_failed");
  expect(() =>
    new DamageResolutionSystem().resolve(world, {
      awakenedEffects: {
        shields: [
          {
            actorId: ids[1]!,
            target: captureNightLife(world, ids[0]!)!,
            isCurrent: () => {
              throw failure;
            },
          },
        ],
        attacks: [],
      },
    }),
  ).toThrow(failure);
  expect(marks.map((mark) => mark.values())).toEqual([
    [StatusMark.WolfKillMark],
    [StatusMark.WolfKillMark],
  ]);
});

test("a late protection getter failure retains the earlier entity's cleared-mark prefix", () => {
  const { world, ids, marks } = fixture();
  const failure = Error("late_protection_query_failed");
  let reads = 0;
  expect(() =>
    new DamageResolutionSystem().resolve(world, {
      get protectedTargets() {
        if (++reads === 2) throw failure;
        return [];
      },
    }),
  ).toThrow(failure);
  expect(reads).toBe(2);
  expect(marks[0]!.values()).toEqual([]);
  expect(marks[1]!.values()).toEqual([StatusMark.WolfKillMark]);
  expect(ids.map((id) => world.getComponent(id, COMPONENT.Alive)!.alive)).toEqual([true, true]);
});

test("ordinary protection cancellation retains the first removal when the second fails", () => {
  const { world, ids } = fixture();
  const failure = Error("heal_mark_removal_failed");
  const removals: StatusMark[] = [];
  class FailingMarks extends StatusMarksComponent {
    override remove(mark: StatusMark) {
      expect<unknown>(this).toBe(marks);
      removals.push(mark);
      if (mark === StatusMark.HealMark) throw failure;
      super.remove(mark);
    }
  }
  const marks = new FailingMarks([
    StatusMark.GuardMark,
    StatusMark.HealMark,
    StatusMark.WolfKillMark,
  ]);
  world.addComponent(ids[0]!, COMPONENT.StatusMarks, marks);
  expect(() => new DamageResolutionSystem().resolve(world)).toThrow(failure);
  expect(removals).toEqual([StatusMark.GuardMark, StatusMark.HealMark]);
  expect(marks.values()).toEqual([StatusMark.HealMark, StatusMark.WolfKillMark]);
});

test("a later immunity query observes cancellation before failing without final clearing", () => {
  const { world, marks } = fixture();
  marks[0]!.add(StatusMark.GuardMark);
  marks[0]!.add(StatusMark.HealMark);
  const failure = Error("immunity_query_failed");
  expect(() =>
    new DamageResolutionSystem().resolve(world, {
      get immuneNightTargets(): readonly number[] {
        expect(marks[0]!.values()).toEqual([StatusMark.WolfKillMark]);
        throw failure;
      },
    }),
  ).toThrow(failure);
  expect(marks[0]!.values()).toEqual([StatusMark.WolfKillMark]);
});
