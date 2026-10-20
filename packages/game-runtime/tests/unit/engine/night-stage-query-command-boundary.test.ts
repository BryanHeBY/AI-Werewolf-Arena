/**
 * 单元测试验证完整内建夜程序与可替换扩展的真实输入边界。
 * 输入为合法六人板、实际赠枪、原函数／同名外来定义和具体伤害命令；编号、事实及零查询预期手写。
 * 组件引用只留可信 fixture 和原 owner，公开 callback 不获 World／状态；同名或替换 execute 不能继承私有输入。
 * 不调用模型或完整对局；此处只核本次边界，不把 Provider 候选或返回值当领域付款。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role, StatusMark, type GameEvent } from "../../../src/domain";
import type {
  NightStageContext,
  NightStageDefinition,
  NightStageHandler,
} from "../../../src/engine/night/contracts";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { DEATH_ABILITY_ACTIVATION_STAGE } from "../../../src/features/death-actions/death-ability-activation";
import { grantDeathGun, allDeathGuns } from "../../../src/features/death-actions/death-abilities";
import { hasDeathAbilityActivationCommit } from "../../../src/features/death-actions/death-ability-activation";
import {
  bindSyntheticNightDamageStage,
  type SyntheticNightDamagePorts,
} from "../../../src/rulesets/night-stage-bindings";
import { executeNightStage, nightStageContext } from "../../support/builders/night-stage-context";

function fixture() {
  const game = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
  });
  const events: GameEvent[] = [];
  const gun = grantDeathGun(game.world, 3, 5, 1, events);
  events.length = 0;
  return { ...game, gun, events, runtime: nightStageContext({ world: game.world, events }) };
}

const forbidden = [
  "world",
  "getWorld",
  "runtime",
  "state",
  "events",
  "roleCatalog",
  "requestFactory",
  "nightActors",
  "nativeNightEffects",
  "ensureMarks",
];

test("原完整程序仍武装同一赠枪并发布原事实，私有资源未复制", async () => {
  const f = fixture(),
    role = f.world.getComponent(5, COMPONENT.Role)!;
  await executeNightStage(DEATH_ABILITY_ACTIVATION_STAGE)(f.runtime);
  expect(allDeathGuns(role)[0]).toBe(f.gun);
  expect(f.gun.armedOnNight).toBe(1);
  expect(hasDeathAbilityActivationCommit(f.world, 1)).toBe(true);
  expect(
    f.events.flatMap((event) =>
      event.type === "death_ability_changed"
        ? [[event.payload.operation, event.payload.actorId, event.payload.armedOnNight]]
        : [],
    ),
  ).toEqual([["armed", 5, 1]]);
});

test("原单例 execute getter 被替换后只收到真实窄对象，callee 与 receiver 保持", async () => {
  const f = fixture(),
    original = Object.getOwnPropertyDescriptor(DEATH_ABILITY_ACTIVATION_STAGE, "execute")!;
  const trace: string[] = [];
  Object.defineProperty(DEATH_ABILITY_ACTIVATION_STAGE, "execute", {
    configurable: true,
    get() {
      trace.push("callee");
      return async function (this: object, ctx: NightStageContext) {
        trace.push("callback");
        expect(this).toBe(DEATH_ABILITY_ACTIVATION_STAGE);
        for (const key of forbidden) expect(key in ctx).toBe(false);
        expect(ctx.entityIds()).toEqual([1, 2, 3, 4, 5, 6]);
        expect(Object.keys(ctx.actionProvider)).toEqual(["getAction"]);
        expect(Object.keys(ctx.actions)).toEqual(["validateAndSanitize"]);
        expect(ctx.ports).toBeUndefined();
      };
    },
  });
  try {
    await executeNightStage(DEATH_ABILITY_ACTIVATION_STAGE)(f.runtime);
  } finally {
    Object.defineProperty(DEATH_ABILITY_ACTIVATION_STAGE, "execute", original);
  }
  expect(trace).toEqual(["callee", "callback"]);
  expect(f.gun.armedOnNight).toBeNull();
  expect(f.events).toEqual([]);
});

test("同 id 且持原函数的外来定义不取得私有输入，也不访问真实枪库存", async () => {
  const f = fixture();
  const foreign: NightStageDefinition = {
    id: DEATH_ABILITY_ACTIVATION_STAGE.id,
    priority: DEATH_ABILITY_ACTIVATION_STAGE.priority,
    execute: DEATH_ABILITY_ACTIVATION_STAGE.execute,
  };
  let reads = 0;
  const descriptor = Object.getOwnPropertyDescriptor(f.world, "getAliveEntityIds");
  Object.defineProperty(f.world, "getAliveEntityIds", {
    configurable: true,
    get() {
      reads++;
      throw new Error("private_world_must_not_be_read");
    },
  });
  try {
    await expect(executeNightStage(foreign)(f.runtime)).rejects.toBeInstanceOf(TypeError);
  } finally {
    if (descriptor) Object.defineProperty(f.world, "getAliveEntityIds", descriptor);
    else Reflect.deleteProperty(f.world, "getAliveEntityIds");
  }
  expect(reads).toBe(0);
  expect(f.gun.armedOnNight).toBeNull();
  expect(hasDeathAbilityActivationCommit(f.world, 1)).toBe(false);
  expect(f.events).toEqual([]);
});

test("自定义合成伤害只取得实际加毒命令，不返回印记组件或整夜状态", async () => {
  const f = fixture();
  const custom: NightStageHandler<SyntheticNightDamagePorts> = {
    id: "literal_synthetic_damage",
    priority: 999,
    async execute(ctx) {
      for (const key of forbidden) expect(key in ctx).toBe(false);
      expect(Object.keys(ctx.ports!)).toEqual(["addPoisonMark"]);
      expect(ctx.ports!.addPoisonMark(5)).toBeUndefined();
    },
  };
  bindSyntheticNightDamageStage(custom);
  await executeNightStage(custom)(f.runtime);
  expect(f.world.getComponent(5, COMPONENT.StatusMarks)!.has(StatusMark.PoisonMark)).toBe(true);
  expect(f.gun.armedOnNight).toBeNull();
  expect(f.events).toEqual([]);
});
