/**
 * 单元测试：用真实 bootstrap、World、请求工厂和网关验证两族未付款行动退休。
 * 原组件引用、字面库存／事件／错误及手写回调轨迹是独立 oracle；不以生产资格函数生成预期。
 * 覆盖已退休原体、Provider 返回、晚目标 getter，以及已提交效果／镜像安装的失败前缀。
 * 两族使用各自合法六人板；只执行具体夜阶段，不运行完整周期、模型、传输或复现。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import {
  Phase,
  Role,
  type ActionProvider,
  type BoardConfig,
  type GameEvent,
  type ToolCall,
} from "../../../src/domain/model";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { retireRoleExecution } from "../../../src/domain/role-execution-authority";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import type { NightStageContext } from "../../../src/engine/night/contracts";
import { bindNightAbilityActorQuery } from "../../../src/features/night-abilities/night-ability-actors";
import { findNightAbility } from "../../../src/features/night-abilities/abilities";
import { getDefaultRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { MECHANICAL_NIGHT_STAGES } from "../../../src/features/mechanical-wolf/night-stages";
import { MECHANICAL_VALIDATION_RULES } from "../../../src/features/mechanical-wolf/rules";
import {
  bindMechanicalSkill,
  captureMechanicalOwner,
  recordMechanicalModeScope,
} from "../../../src/features/mechanical-wolf/night-scope";
import {
  getMechanicalState,
  learnMechanicalRole,
  selectMechanicalMode,
  recordMechanicalInspection,
} from "../../../src/features/mechanical-wolf/state";
import { AWAKENED_NIGHT_STAGES } from "../../../src/features/awakened-hidden-wolf/night-stages";
import { AWAKENED_VALIDATION_RULES } from "../../../src/features/awakened-hidden-wolf/rules";
import {
  bindAwakenedSkill,
  captureAwakenedOwner,
  currentAwakenedNight,
} from "../../../src/features/awakened-hidden-wolf/night-scope";
import {
  activateAwakenedLearning,
  getAwakenedState,
  learnAwakenedRole,
} from "../../../src/features/awakened-hidden-wolf/state";
import { armAwakenedNativeGun } from "../../../src/features/death-actions/native-death-gun-resources";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

type Family = "mechanical" | "awakened";
function fixture(family: Family) {
  const roles = [
    family === "mechanical" ? Role.MechanicalWolf : Role.AwakenedHiddenWolf,
    Role.Wolf,
    Role.Witch,
    Role.Guard,
    Role.Hunter,
    Role.Villager,
  ];
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: roles.map((role) => ({ role, count: 1 })),
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const role = game.world.getComponent(1, COMPONENT.Role)!;
  return family === "mechanical"
    ? { family: "mechanical" as const, game, role, state: getMechanicalState(role)! }
    : { family: "awakened" as const, game, role, state: getAwakenedState(role)! };
}
type Fixture = ReturnType<typeof fixture>;
function context(f: Fixture, getAction: ActionProvider["getAction"], day = 2): NightStageContext {
  const events: GameEvent[] = [],
    requests = new GameActionRequestFactory(f.game.world, events, day);
  return {
    world: f.game.world,
    events,
    currentDay: () => day,
    isCurrent: () => true,
    previousExile: null,
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    get requestFactory() {
      return GameActionRequestFactory;
    },
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
    },
    get nativeNightFailure() {
      return bindNativeNightFailurePolicy(() => this.world);
    },
    get nativeNightTargets() {
      return bindNativeNightTargetPolicy(() => this);
    },
    get nativeNightEffects() {
      return bindNativeNightEffects(() => this);
    },
    actionProvider: { getAction },
    makeRequest: (actorId, allowedTools, extra) =>
      requests.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        summary: { key: "request.summary.night_action" },
        context: extra,
      }),
    getAliveByRole: (role) =>
      f.game.world
        .getAliveEntityIds()
        .filter((id) => f.game.world.getComponent(id, COMPONENT.Role)?.role === role),
    ensureMarks: (id) => f.game.world.getComponent(id, COMPONENT.StatusMarks)!,
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => ids,
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      poisonClaims: [],
      mechanicalEffects: { shields: [], attacks: [], failures: [] },
      awakenedEffects: { shields: [], attacks: [] },
    },
  };
}
const stage = (family: Family, id: string) =>
  (family === "mechanical" ? MECHANICAL_NIGHT_STAGES : AWAKENED_NIGHT_STAGES).find(
    (value) => value.id === id,
  )!;
function owner(f: Fixture) {
  return f.family === "mechanical"
    ? captureMechanicalOwner(f.game.world, 1, () => true)!
    : captureAwakenedOwner(f.game.world, 1, () => true)!;
}
async function prepare(f: Fixture, ctx: NightStageContext, template: "witch" | "guard") {
  if (f.family === "mechanical") {
    expect(learnMechanicalRole(f.state, template === "witch" ? 3 : 4, template, 1)).toBe(true);
    expect(selectMechanicalMode(f.state, 2, "skill")).toBe(true);
    expect(
      recordMechanicalModeScope(
        f.game.world,
        captureMechanicalOwner(f.game.world, 1, () => true)!,
        2,
      ),
    ).toBe(true);
  } else {
    expect(learnAwakenedRole(f.state, template === "witch" ? 3 : 4, template, 1)).toBe(true);
    expect(activateAwakenedLearning(f.state, 1)).toBe(true);
    await stage("awakened", "awakened_opening").execute(ctx);
  }
}

test("两族退休原体仍满足纯当前性，但不能开出新请求或写入学习与模式", async () => {
  for (const family of ["mechanical", "awakened"] as const) {
    const f = fixture(family),
      scope = owner(f),
      before = JSON.stringify(f.state);
    let requests = 0;
    const ctx = context(f, async () => {
      requests++;
      return null;
    });
    retireRoleExecution(f.role);
    expect(scope.isCurrent()).toBe(true);
    expect(scope.canAct()).toBe(false);
    if (family === "mechanical") await stage(family, "mechanical_mode").execute(ctx);
    else {
      await stage(family, "awakened_opening").execute(ctx);
      expect(currentAwakenedNight(f.game.world, f.role)).toBeNull();
    }
    await stage(family, `${family}_mimic`).execute(ctx);
    expect(requests).toBe(0);
    expect(JSON.stringify(f.state)).toBe(before);
    expect(ctx.events).toEqual([]);
  }
});

test("机械 Provider 返回后退休不写默认模式，原当前性不被改变", async () => {
  const f = fixture("mechanical"),
    trace: string[] = [];
  const ctx = context(f, async () => {
    trace.push("provider");
    retireRoleExecution(f.role);
    return null;
  });
  await stage("mechanical", "mechanical_mode").execute(ctx);
  expect(trace).toEqual(["provider"]);
  expect(f.state.learned).toBeNull();
  if (f.family !== "mechanical") throw new Error("fixture_family_mismatch");
  expect(f.state.mode).toBeNull();
  expect(owner(f).isCurrent()).toBe(true);
  expect(ctx.events).toEqual([]);
});

test("晚目标 getter 退休后两族拒绝首付款，getter 原异常仍优先传播", async () => {
  for (const family of ["mechanical", "awakened"] as const) {
    const f = fixture(family),
      trace: string[] = [],
      originalError = new Error("late_target_original");
    const call: ToolCall =
      family === "mechanical"
        ? { name: "mechanical_poison", args: { target_id: 6 } }
        : { name: "awakened_poison", args: { target_id: 6 } };
    const ctx = context(f, async () => call);
    await prepare(f, ctx, "witch");
    const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
    ctx.toolGateway.validateAndSanitize = (...args) => {
      const result = validate(...args);
      if (!result.sanitizedCall || !("target_id" in result.sanitizedCall.args))
        throw new Error("fixture_sanitized_target_missing");
      Object.defineProperty(result.sanitizedCall.args, "target_id", {
        configurable: true,
        get() {
          trace.push("target");
          retireRoleExecution(f.role);
          // 两个独立轨迹：机械返回原 ID；觉醒在同一原读取点抛原 Error。
          if (family === "awakened") throw originalError;
          return 6;
        },
      });
      return result;
    };
    if (family === "mechanical") await stage(family, "mechanical_skill").execute(ctx);
    else await expect(stage(family, "awakened_skill").execute(ctx)).rejects.toBe(originalError);
    expect(trace).toEqual(["target"]);
    expect(owner(f).isCurrent()).toBe(true);
    expect(f.state.learned!.skill).toEqual({ kind: "poison", remaining: 1 });
    expect(f.state.skillClosedDay).toBeNull();
    expect(ctx.state.poisonClaims).toEqual([]);
    expect(ctx.events).toEqual([]);
    const validateRules =
      family === "mechanical" ? MECHANICAL_VALIDATION_RULES : AWAKENED_VALIDATION_RULES;
    expect(
      validateRules[call.name]!({
        world: ctx.world,
        roleCatalog: ctx.roleCatalog,
        actorId: 1,
        role: f.role,
        day: 2,
        phase: Phase.Night,
        toolCall: call,
      }),
    ).toEqual({
      code:
        family === "mechanical" ? RuleError.MechanicalUnavailable : RuleError.AwakenedUnavailable,
    });
  }
});

test("两族付款后事实失败保库存与效果，晚退休不取消已付当前性或重新开请求", async () => {
  for (const family of ["mechanical", "awakened"] as const) {
    const f = fixture(family),
      trace: string[] = [],
      originalError = new Error("paid_fact_original");
    const ctx = context(f, async () => {
      trace.push("provider");
      return family === "mechanical"
        ? { name: "mechanical_guard", args: { target_id: 6 } }
        : { name: "awakened_guard", args: { target_id: 6 } };
    });
    await prepare(f, ctx, "guard");
    const bound =
      f.family === "mechanical"
        ? bindMechanicalSkill(
            captureMechanicalOwner(f.game.world, 1, () => true)!,
            2,
          )!
        : bindAwakenedSkill(
            captureAwakenedOwner(f.game.world, 1, () => true)!,
            2,
          )!;
    expect(bound.isCurrent()).toBe(true);
    ctx.events.push = () => {
      trace.push("fact");
      retireRoleExecution(f.role);
      throw originalError;
    };
    await expect(stage(family, `${family}_skill`).execute(ctx)).rejects.toBe(originalError);
    expect(trace).toEqual(["provider", "fact"]);
    expect(f.state.learned!.skill).toEqual({ kind: "guard", lastTarget: 6, lastGuardDay: 2 });
    expect(f.state.skillClosedDay).toBe(family === "mechanical" ? null : 2);
    const effect =
      family === "mechanical"
        ? ctx.state.mechanicalEffects!.shields[0]
        : ctx.state.awakenedEffects!.shields[0];
    expect(effect.target.id).toBe(6);
    expect(effect.isCurrent!()).toBe(true);
    const scope = owner(f);
    expect(scope.isCurrent()).toBe(true);
    expect(scope.canAct()).toBe(false);
    // 原绑定 reader 不读行动墓碑；它不是重新开启技能请求的入口。
    expect(bound.isCurrent()).toBe(true);
    await stage(family, `${family}_skill`).execute(ctx);
    expect(trace).toEqual(["provider", "fact"]);
    f.game.world.getComponent(1, COMPONENT.Alive)!.alive = false;
    expect(effect.isCurrent!()).toBe(family === "awakened");
    expect(ctx.events).toEqual([]);
  }
});

test("觉醒镜像已安装后晚退休仍完成原激活前缀，不撤回已安装实例", async () => {
  const f = fixture("awakened");
  if (f.family !== "awakened") throw new Error("fixture_family_mismatch");
  expect(learnAwakenedRole(f.state, 3, Role.MirrorGirl, 1)).toBe(true);
  const ctx = context(
    f,
    async () => {
      throw new Error("activation_must_not_request");
    },
    1,
  );
  await stage("awakened", "awakened_opening").execute(ctx);
  const read = f.game.world.getComponent.bind(f.game.world),
    trace: string[] = [];
  // 局部 World 查询保持原结果；只在真实实例已安装后的原 Camp 读取点退休该 Role。
  f.game.world.getComponent = ((id, name) => {
    const result = read(id, name);
    if (id === 1 && name === COMPONENT.Camp && findNightAbility(f.role, "role_check")) {
      trace.push("installed-camp");
      retireRoleExecution(f.role);
    }
    return result;
  }) as typeof f.game.world.getComponent;
  await stage("awakened", "awakened_activation").execute(ctx);
  expect(trace).toEqual(["installed-camp"]);
  expect(findNightAbility(f.role, "role_check")).toBeDefined();
  expect(f.state.learned!.activationNight).toBe(1);
  expect(f.state.learned!.activeFromNight).toBe(2);
  expect(ctx.events.map((event) => event.type)).toEqual(["awakened_ready"]);
  expect(owner(f).canAct()).toBe(false);
});

test("机械模式 helper 内最后资格 getter 退休，不产生首次模式写入", async () => {
  const f = fixture("mechanical");
  if (f.family !== "mechanical") throw new Error("fixture_family_mismatch");
  let reads = 0,
    writes = 0;
  const ctx = context(f, async () => {
    Object.defineProperty(f.state, "mode", {
      configurable: true,
      enumerable: true,
      get() {
        reads++;
        if (reads === 2) retireRoleExecution(f.role);
        return null;
      },
      set() {
        writes++;
      },
    });
    return null;
  });
  await stage("mechanical", "mechanical_mode").execute(ctx);
  expect(reads).toBe(3);
  expect(writes).toBe(0);
  expect(ctx.events).toEqual([]);
  expect(owner(f).isCurrent()).toBe(true);
  expect(owner(f).canAct()).toBe(false);
});

test("两族守护 helper 内历史 getter 退休，不付款也不添加盾或惩罚", async () => {
  for (const family of ["mechanical", "awakened"] as const) {
    const f = fixture(family),
      trace: string[] = [];
    const ctx = context(f, async () =>
      family === "mechanical"
        ? { name: "mechanical_guard", args: { target_id: 6 } }
        : { name: "awakened_guard", args: { target_id: 6 } },
    );
    await prepare(f, ctx, "guard");
    const skill = f.state.learned!.skill;
    if (skill.kind !== "guard") throw new Error("fixture_guard_missing");
    const validate = ctx.toolGateway.validateAndSanitize.bind(ctx.toolGateway);
    ctx.toolGateway.validateAndSanitize = (...args) => {
      const result = validate(...args);
      Object.defineProperty(skill, "lastTarget", {
        configurable: true,
        enumerable: true,
        get() {
          trace.push("history");
          retireRoleExecution(f.role);
          return null;
        },
        set() {
          trace.push("write");
        },
      });
      return result;
    };
    await stage(family, `${family}_skill`).execute(ctx);
    expect(trace).toEqual(["history"]);
    expect(skill.lastGuardDay).toBeNull();
    expect(f.state.skillClosedDay).toBeNull();
    expect(ctx.state.mechanicalEffects).toEqual({ shields: [], attacks: [], failures: [] });
    expect(ctx.state.awakenedEffects).toEqual({ shields: [], attacks: [] });
    expect(ctx.events).toEqual([]);
    expect(owner(f).isCurrent()).toBe(true);
  }
});

test("觉醒武装 owner 在最后枪引用 getter 退休，不写 armed", () => {
  const f = fixture("awakened");
  if (f.family !== "awakened") throw new Error("fixture_family_mismatch");
  expect(learnAwakenedRole(f.state, 5, Role.Hunter, 1)).toBe(true);
  const learned = f.state.learned!,
    gun = learned.skill,
    scope = owner(f),
    trace: string[] = [];
  let reads = 0;
  Object.defineProperty(learned, "skill", {
    configurable: true,
    enumerable: true,
    get() {
      trace.push(++reads === 1 ? "kind" : "gun");
      if (reads === 2) retireRoleExecution(f.role);
      return gun;
    },
  });
  expect(armAwakenedNativeGun(learned, scope.canAct)).toBe(false);
  expect(trace).toEqual(["kind", "gun"]);
  expect(gun).toEqual({ kind: "hunter", canShoot: true, armed: false });
  expect(learned.activationNight).toBeNull();
  expect(learned.activeFromNight).toBeNull();
  expect(scope.isCurrent()).toBe(true);
});

test("镜像字典已创建但原身份 getter 退休，保空字典而不安装或激活", async () => {
  const f = fixture("awakened");
  if (f.family !== "awakened") throw new Error("fixture_family_mismatch");
  expect(learnAwakenedRole(f.state, 3, Role.MirrorGirl, 1)).toBe(true);
  const ctx = context(
    f,
    async () => {
      throw new Error("activation_must_not_request");
    },
    1,
  );
  await stage("awakened", "awakened_opening").execute(ctx);
  const trace: string[] = [];
  expect(findNightAbility(f.role, "role_check")).toBeUndefined();
  Object.defineProperty(f.role, "role", {
    configurable: true,
    enumerable: true,
    get() {
      const dictionary = (f.role.privateState as { abilities?: Record<string, unknown> }).abilities;
      if (dictionary && !dictionary["native:role_check"]) {
        trace.push("dictionary-before-install");
        retireRoleExecution(f.role);
      }
      return Role.AwakenedHiddenWolf;
    },
  });
  await stage("awakened", "awakened_activation").execute(ctx);
  expect(trace).toEqual(["dictionary-before-install"]);
  expect((f.role.privateState as { abilities?: object }).abilities).toEqual({});
  expect(f.state.learned!.activationNight).toBeNull();
  expect(f.state.learned!.activeFromNight).toBeNull();
  expect(ctx.events).toEqual([]);
});

test("机械已学习枪的开夜武装仍完成，退休只拒绝新的模式与请求", async () => {
  const f = fixture("mechanical");
  if (f.family !== "mechanical") throw new Error("fixture_family_mismatch");
  expect(learnMechanicalRole(f.state, 5, Role.Hunter, 1)).toBe(true);
  let requests = 0;
  const ctx = context(f, async () => {
    requests++;
    return null;
  });
  retireRoleExecution(f.role);
  await stage("mechanical", "mechanical_mode").execute(ctx);
  expect(f.state.learned!.skill).toEqual({ kind: "hunter", canShoot: true, armed: true });
  expect(f.state.mode).toBeNull();
  expect(requests).toBe(0);
  expect(ctx.events).toEqual([]);
  expect(owner(f).isCurrent()).toBe(true);
});

test("默认查验数据入口不读取 Reflect，原 push receiver 与参数 getter 错误保持", () => {
  const originalApply = Object.getOwnPropertyDescriptor(Reflect, "apply")!;
  const trace: string[] = [],
    history: unknown[] = [],
    originalError = new Error("inspection_target_original");
  let receiver: unknown,
    thrown: unknown,
    failTarget = false;
  const reports: Array<{ day: number; targetId: number; result: { kind: "role"; role: Role } }> =
    [];
  Object.defineProperty(reports, "push", {
    configurable: true,
    get() {
      trace.push("push");
      return function (this: unknown, row: unknown) {
        receiver = this;
        history.push(row);
        trace.push("append");
        return 1;
      };
    },
  });
  const skill = {
    kind: "inspection" as const,
    get history() {
      trace.push("history");
      return reports;
    },
  };
  const target = {
    get id() {
      trace.push("target");
      if (failTarget) throw originalError;
      return 5;
    },
  };
  const result = {
    kind: "role" as const,
    get role() {
      trace.push("result");
      return Role.Hunter;
    },
  };
  Object.defineProperty(Reflect, "apply", {
    configurable: true,
    get() {
      trace.push("unexpected-reflect");
      throw new Error("default_reflect_must_not_read");
    },
  });
  try {
    recordMechanicalInspection(skill, 2, target, result);
    failTarget = true;
    try {
      recordMechanicalInspection(skill, 2, target, result);
    } catch (error) {
      thrown = error;
    }
  } finally {
    Object.defineProperty(Reflect, "apply", originalApply);
  }
  expect(trace).toEqual([
    "history",
    "push",
    "target",
    "result",
    "append",
    "history",
    "push",
    "target",
  ]);
  expect(receiver).toBe(reports);
  expect(history).toEqual([{ day: 2, targetId: 5, result: { kind: "role", role: Role.Hunter } }]);
  expect(thrown).toBe(originalError);
});

test("受控查验 Reflect callee getter 退休后不追加历史", () => {
  const f = fixture("mechanical");
  if (f.family !== "mechanical") throw new Error("fixture_family_mismatch");
  expect(learnMechanicalRole(f.state, 3, Role.Psychic, 1)).toBe(true);
  const skill = f.state.learned!.skill,
    scope = owner(f);
  if (skill.kind !== "inspection") throw new Error("fixture_inspection_missing");
  const originalApply = Object.getOwnPropertyDescriptor(Reflect, "apply")!;
  let reads = 0,
    accepted: boolean | undefined;
  Object.defineProperty(Reflect, "apply", {
    configurable: true,
    get() {
      reads++;
      retireRoleExecution(f.role);
      return originalApply.value;
    },
  });
  try {
    accepted = recordMechanicalInspection(
      skill,
      2,
      { id: 5 },
      { kind: "role", role: Role.Hunter },
      scope.canAct,
    );
  } finally {
    Object.defineProperty(Reflect, "apply", originalApply);
  }
  expect(accepted).toBe(false);
  expect(reads).toBe(1);
  expect(skill.history).toEqual([]);
  expect(scope.isCurrent()).toBe(true);
  expect(scope.canAct()).toBe(false);
});
