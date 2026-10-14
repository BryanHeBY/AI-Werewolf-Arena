/**
 * 单元测试：验证狼美人具体触发的 claimed／blocked／applied 阶段和原体权限。
 * 输入为原生命、字面死因、未领取 proposal、保护故障和真实有界 DeathResolution；
 * 输出以领取旗标、独立事件、引用与错误前缀验收。被梦阻断仍付款，同波首次死亡有效，复活无效。
 * 规则依据 docs/rules/awa-wolf-beauty-v1.md；不执行完整对局、模型或网络，预期不从生产生成。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";

import { Camp, Role, Phase, DeathCause, type GameEvent } from "../../../../src/core/domain/model";
import {
  getWolfBeautyState,
  setWolfBeautyState,
  attemptCharmTrigger,
  commitCharmDeath,
  type CharmBinding,
  type CharmClaimReceipt,
  type CharmBlockedReceipt,
} from "../../../../src/game/mechanisms/roles/wolf_beauty/ports";
import { activeCharm, bindCharm } from "../../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { wolfBeautyDeathHook } from "../../../../src/game/mechanisms/roles/wolf_beauty/death_hook";
import { HookRegistry } from "../../../../src/game/mechanisms/hooks/hook_registry";
import { EventRegistry } from "../../../../src/game/engine/event_registry";
import { DeathResolution } from "../../../../src/game/engine/death_resolution";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";

function fixture(
  policy: "awa_exile_poison_v1" | "heroes_s7_2017_exile_hunter_v1" = "awa_exile_poison_v1",
) {
  const world = new World("en"),
    actor = world.createEntity(),
    target = world.createEntity();
  const role = createRoleComponent(Role.WolfBeauty);
  setWolfBeautyState(role, {
    targetId: target,
    lastActedDay: 1,
    history: [],
    deathLinkPolicy: policy,
  });
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(target, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(target, COMPONENT.Camp, { camp: Camp.Good });
  const actorLife = createAliveComponent(),
    targetLife = createAliveComponent();
  world.addComponent(actor, COMPONENT.Alive, actorLife);
  world.addComponent(target, COMPONENT.Alive, targetLife);
  bindCharm(world, actor, target);
  return { world, actor, target, role, actorLife, targetLife, binding: activeCharm(world, actor)! };
}

test("night protection returns blocked after paid claim and cannot refund another trigger", () => {
  const f = fixture(),
    trace: string[] = [];
  f.actorLife.alive = false;
  const blocked = attemptCharmTrigger(
    f.binding,
    { [f.actor]: [DeathCause.Poison] },
    new Set(),
    new Set([f.actor]),
    () => {
      trace.push("world");
      return f.world;
    },
    () => {
      trace.push("protect");
      expect(f.binding.resolved).toBe(true);
      return true;
    },
  );
  expect(blocked?.kind).toBe("blocked");
  expect(trace).toEqual(["world", "protect"]);
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(false);
  expect(f.targetLife.alive).toBe(true);
  expect(
    attemptCharmTrigger(
      f.binding,
      { [f.actor]: [DeathCause.Poison] },
      new Set(),
      new Set([f.actor]),
      () => f.world,
      () => false,
    ),
  ).toBeNull();
});

test("protection failure retains the original claim while publishing no applied result", () => {
  const f = fixture(),
    failure = new Error("original_charm_protection_failure");
  f.actorLife.alive = false;
  expect(() =>
    attemptCharmTrigger(
      f.binding,
      { [f.actor]: [DeathCause.Poison] },
      new Set(),
      new Set([f.actor]),
      () => f.world,
      () => {
        throw failure;
      },
    ),
  ).toThrow(failure);
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(false);
  expect(f.targetLife.alive).toBe(true);
});

test("compound suppression refuses before World or protection and native Hunter qualification remains distinct", () => {
  const f = fixture();
  f.actorLife.alive = false;
  expect(
    attemptCharmTrigger(
      f.binding,
      { [f.actor]: [DeathCause.Poison, DeathCause.Dream] },
      new Set(),
      new Set(),
      () => {
        throw new Error("world_must_not_read");
      },
      () => {
        throw new Error("protect_must_not_read");
      },
    ),
  ).toBeNull();
  expect(f.binding.resolved).toBe(false);
  const s7 = fixture("heroes_s7_2017_exile_hunter_v1");
  s7.actorLife.alive = false;
  expect(
    attemptCharmTrigger(
      s7.binding,
      { [s7.actor]: [DeathCause.Shot] },
      new Set(),
      new Set(),
      () => {
        throw new Error("gift_shot_must_not_claim");
      },
      () => false,
    ),
  ).toBeNull();
  expect(
    attemptCharmTrigger(
      s7.binding,
      { [s7.actor]: [DeathCause.Shot] },
      new Set([s7.actor]),
      new Set(),
      () => s7.world,
      () => false,
    )?.kind,
  ).toBe("claimed");
});

test("same-wave first death commits applied while a copied receipt cannot authorize it", () => {
  const f = fixture();
  f.actorLife.alive = false;
  f.targetLife.alive = false;
  const claim = attemptCharmTrigger(
    f.binding,
    { [f.actor]: [DeathCause.Exile] },
    new Set(),
    new Set([f.actor, f.target]),
    () => f.world,
    () => false,
  );
  expect(claim?.kind).toBe("claimed");
  if (!claim || claim.kind !== "claimed") throw new Error("fixture_claim_missing");
  expect(commitCharmDeath(f.world, { ...claim })).toBeNull();
  expect(f.binding.applied).toBe(false);
  expect(commitCharmDeath(f.world, claim)?.kind).toBe("applied");
  expect(f.binding.applied).toBe(true);
  expect(Object.keys(claim)).toEqual(["kind"]);
  expect(JSON.stringify(claim)).toBe('{"kind":"claimed"}');
});

test("revival and replacement cannot turn a paid receipt into an applied relationship", () => {
  for (const replacement of [false, true]) {
    const f = fixture();
    f.actorLife.alive = false;
    const claim = attemptCharmTrigger(
      f.binding,
      { [f.actor]: [DeathCause.Exile] },
      new Set(),
      new Set([f.actor]),
      () => f.world,
      () => false,
    );
    if (!claim || claim.kind !== "claimed") throw new Error("fixture_claim_missing");
    if (replacement) f.world.addComponent(f.target, COMPONENT.Alive, createAliveComponent(false));
    else {
      f.targetLife.alive = false;
      f.targetLife.alive = true;
      f.targetLife.alive = false;
    }
    expect(commitCharmDeath(f.world, claim)).toBeNull();
    expect(f.binding.applied).toBe(false);
  }
});

test("the real death hook and resolver consume a claimed receipt before publishing only actual charm death", async () => {
  const f = fixture(),
    events: GameEvent[] = [];
  const resolver = new DeathResolution(
    f.world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], [wolfBeautyDeathHook])),
    { day: 2, phase: Phase.Day, gameOver: false, result: null },
  );
  await resolver.resolve(
    [f.actor],
    { [f.actor]: [DeathCause.Exile] },
    {
      async getAction() {
        return { name: "speak", args: { text: "Raw last words" } };
      },
    },
    Phase.Day,
    Phase.Day,
  );
  expect(f.actorLife.alive).toBe(false);
  expect(f.targetLife.alive).toBe(false);
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(true);
  expect(events.filter((e) => e.type === "charm_death").map((e) => e.payload)).toEqual([
    { actorId: f.actor, targetId: f.target },
  ]);
  expect(events.filter((e) => e.type === "charm_blocked")).toEqual([]);
  expect(getWolfBeautyState(f.role)!.targetId).toBe(f.target);
});

function deniedReadWrites(binding: CharmBinding, blocked: CharmBlockedReceipt) {
  // @ts-expect-error 查询端点不授予目标原生命的修改权。
  binding.targetLife.alive = true;
  // @ts-expect-error Role.camp旧运行输入已退休，关系读视图不重新提供该字段。
  binding.role.camp = Camp.Good;
  // @ts-expect-error 领取标记属于唯一 relation owner。
  binding.resolved = false;
  // @ts-expect-error applied 只在实际死亡之后由关系 owner 提交。
  binding.applied = true;
  // @ts-expect-error blocked 不能当作 claimed 回执提交。
  commitCharmDeath(new World(), blocked);
  // @ts-expect-error 字面对象不能伪造 opaque claimed 身份。
  const forged: CharmClaimReceipt = { kind: "claimed" };
  void forged;
}
void deniedReadWrites;
