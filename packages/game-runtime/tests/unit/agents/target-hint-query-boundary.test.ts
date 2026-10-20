/**
 * 单元测试验证目标提示扩展的实际窄对象、冷绑定和捕获引用；编号预期手写，不从生产提示反推规则。
 * 查询与提示均不授行动许可，也不支付资源或打开阶段。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role } from "../../../src/domain";
import { World } from "../../../src/domain/world";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import {
  bindTargetHintContext,
  DefaultTargetHintRegistry,
} from "../../../src/agents/tool-repair/target-hint-registry";
import type { TargetHintRegistry } from "../../../src/agents/tool-repair/contracts";

function fixture() {
  return bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
  });
}

test("真实自定义提示回调只得到候选和受限能力查询，不返回原组件", () => {
  const { world } = fixture();
  const source = {
    world,
    actorId: 4,
    actorRole: Role.Guard,
    day: 1,
    allowedTools: ["guard" as const],
  };
  const ctx = bindTargetHintContext(source);
  const custom: TargetHintRegistry = {
    buildActionableIdsHint(observed) {
      expect(observed).toBe(ctx);
      for (const key of ["world", "roleCatalog", "getWorld", "runtime"])
        expect(key in observed).toBe(false);
      for (const key of ["world", "getWorld", "getComponent", "addComponent", "openDeathAction"])
        expect(key in observed.queries).toBe(false);
      expect(observed.queries.aliveIds()).toEqual([1, 2, 3, 4, 5, 6]);
      const actor = observed.queries.actorRules();
      expect(Object.keys(actor).sort()).toEqual(["awakenedGuardAllowed", "luckyAllowed", "potion"]);
      expect(actor.luckyAllowed("guard", 5)).toBe(true);
      expect(actor.potion()).toBeUndefined();
      expect(observed.queries.inspection()).toBeUndefined();
      return "自定义原文";
    },
  };
  expect(custom.buildActionableIdsHint(ctx)).toBe("自定义原文");
  expect(new DefaultTargetHintRegistry().buildActionableIdsHint(ctx)?.match(/\b\d+\b/g)).toEqual([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
  ]);
  expect(world.activeDeathActionCount).toBe(0);
});

test("绑定和无目标工具分支不读取世界，第一次实际查询保持原错误", () => {
  const trace: string[] = [],
    failure = new Error("late_hint_world");
  const ctx = bindTargetHintContext({
    get world(): World {
      trace.push("world");
      throw failure;
    },
    actorId: 1,
    allowedTools: ["speak"],
  });
  expect(trace).toEqual([]);
  expect(new DefaultTargetHintRegistry().buildActionableIdsHint(ctx)).toBeUndefined();
  expect(trace).toEqual([]);
  try {
    ctx.queries.locale();
    throw Error("must_throw");
  } catch (error) {
    expect(error).toBe(failure);
  }
  expect(trace).toEqual(["world"]);
});

test("候选查询跨世界隔离，源字段晚读且编号数组不写回世界", () => {
  const first = fixture().world,
    second = fixture().world;
  const source = { world: first, actorId: 4, allowedTools: ["guard" as const] };
  const ctx = bindTargetHintContext(source);
  const other = bindTargetHintContext({ world: second, actorId: 4, allowedTools: ["guard"] });
  first.getComponent(1, COMPONENT.Alive)!.alive = false;
  expect(ctx.queries.aliveIds()).toEqual([2, 3, 4, 5, 6]);
  expect(other.queries.aliveIds()).toEqual([1, 2, 3, 4, 5, 6]);
  ctx.queries.aliveIds().push(99);
  expect(first.entityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  source.actorId = 5;
  expect(ctx.actorId).toBe(5);
});
