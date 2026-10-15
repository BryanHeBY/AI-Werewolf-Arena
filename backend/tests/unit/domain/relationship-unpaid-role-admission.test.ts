/**
 * 单元测试验证丘比特、混血儿、狼美人的未付执行退休与已付关系边界。输入是三族合法六人板、真实阶段／网关和明确迟到 getter；
 * 输出以手写字面请求数、字段、组件引用、事件顺序及同一 Error 为预期，不从新准入算法生成 oracle。
 * 只执行具体选择阶段或真实关系命令，不运行完整夜管线、死亡波、种子矩阵或模型；默认数据绑定不是行动许可。
 */
import { expect, test } from "bun:test";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Camp, COMPONENT, KnightDuelWindow, Phase, Role, WinCondition,
  type ActionRequest, type BoardConfig, type GameEvent, type ToolCall,
} from "../../../src/domain";
import type { World } from "../../../src/domain/world";
import { captureNightLife } from "../../../src/domain/night-effects";
import { isRoleExecutionRetired, retireRoleExecution } from "../../../src/domain/role-execution-authority";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { CUPID_STAGE } from "../../../src/game/mechanisms/roles/cupid/night_stage";
import { getCupidState } from "../../../src/game/mechanisms/roles/cupid/state-slot";
import { bindLovers, livingOriginalLovers, loversRecord, projectLover } from "../../../src/game/mechanisms/roles/cupid/relation";
import { HYBRID_STAGE } from "../../../src/game/mechanisms/roles/hybrid/night_stage";
import { getHybridState } from "../../../src/game/mechanisms/roles/hybrid/state-slot";
import { WOLF_BEAUTY_CHARM_STAGE } from "../../../src/game/mechanisms/roles/wolf_beauty/night_stages";
import { getWolfBeautyState } from "../../../src/game/mechanisms/roles/wolf_beauty/state";
import { activeCharm, isCharmBindingCurrent } from "../../../src/game/mechanisms/roles/wolf_beauty/relation";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { nightStageContext } from "../../support/builders/night-stage-context";

const families = ["cupid", "hybrid", "wolf_beauty"] as const;
type Family = typeof families[number];
const stages = { cupid: CUPID_STAGE, hybrid: HYBRID_STAGE, wolf_beauty: WOLF_BEAUTY_CHARM_STAGE };
const unavailable = { cupid: RuleError.CupidUnavailable, hybrid: RuleError.HybridUnavailable, wolf_beauty: RuleError.CharmUnavailable };

function choice(family: Family): ToolCall {
  if (family === "cupid") return { name: "choose_lovers", args: { first_id: 5, second_id: 6 } };
  if (family === "hybrid") return { name: "choose_exemplar", args: { target_id: 5 } };
  return { name: "charm", args: { target_id: 5 } };
}

function fixture(family: Family, reply?: (request: ActionRequest) => Promise<ToolCall | null>) {
  const roles = family === "cupid"
    ? [Role.Cupid, Role.Hunter, Role.Wolf, Role.Villager, Role.Wolf, Role.Villager]
    : family === "hybrid"
      ? [Role.Hybrid, Role.Wolf, Role.HiddenWolf, Role.Seer, Role.Witch, Role.Villager]
      : [Role.WolfBeauty, Role.Wolf, Role.Witch, Role.Knight, Role.Villager, Role.Villager];
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    boardSize: 6,
    roleSetups: [...new Set(roles)].map((role) => ({ role, count: roles.filter((id) => id === role).length })),
    winConditions: [family === "wolf_beauty" ? WinCondition.SlaughterSide : WinCondition.SlaughterCity],
    selfDestruct: { enabledWindows: [] },
    ...(family === "cupid" ? { cupid: { policy: "netease_2017_cupid_follows_lovers_v1" as const } } : {}),
    ...(family === "wolf_beauty" ? { knight: { enabledWindows: [KnightDuelWindow.AfterSpeeches] } } : {}),
  };
  const game = bootstrapGame(config, { fixedRoles: roles }),
    events: GameEvent[] = [],
    role = game.world.getComponent(1, COMPONENT.Role)!,
    stats = { requests: 0, providers: 0, receiverOK: false },
    trace: string[] = [],
    factory = new GameActionRequestFactory(game.world, events, 1),
    gateway = new ToolGateway();
  const provider: NightStageContext["actionProvider"] = {
    async getAction(request) {
      stats.providers++;
      stats.receiverOK = this === provider;
      trace.push("provider");
      return reply ? reply(request) : choice(family);
    },
  };
  const ctx = nightStageContext({
    world: game.world, events, toolGateway: gateway, actionProvider: provider,
    // 只选真实第一个演员；目标仍由真实 World 枚举，不在 builder 中做权限预判。
    getAliveByRole: () => [1],
    makeRequest: function (this: NightStageContext, actorId, allowedTools, extra) {
      if (this.world !== game.world) throw new Error("fixture_request_receiver_changed");
      stats.requests++;
      trace.push("request");
      return factory.create({ actorId, allowedTools, phase: Phase.Night, stage: extra.stage,
        requiresAction: extra.requiresAction ?? true, context: extra, summary: "Offline F05d relationship input" });
    },
  });
  return { ...game, family, role, events, stats, trace, ctx, provider, gateway };
}
type Fixture = ReturnType<typeof fixture>;
const run = async (f: Fixture) => { await stages[f.family].execute(f.ctx); };

function unpaid(f: Fixture) {
  if (f.family === "cupid") {
    expect(getCupidState(f.role)!.remaining).toBe(1);
    expect(getCupidState(f.role)!.choice).toBeNull();
    expect(loversRecord(f.world)).toBeNull();
  } else if (f.family === "hybrid") {
    expect(getHybridState(f.role)!.remaining).toBe(1);
    expect(getHybridState(f.role)!.choice).toBeNull();
    expect(f.world.getComponent(1, COMPONENT.Victory)!.affiliations).toEqual([]);
  } else {
    expect(getWolfBeautyState(f.role)!.targetId).toBeNull();
    expect(getWolfBeautyState(f.role)!.lastActedDay).toBeNull();
    expect(getWolfBeautyState(f.role)!.history).toEqual([]);
    expect(activeCharm(f.world, 1)).toBeNull();
  }
  expect(f.events).toEqual([]);
  expect(f.world.getComponent(1, COMPONENT.Role)).toBe(f.role);
  expect(f.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
}
function paid(f: Fixture) {
  if (f.family === "cupid") {
    expect(getCupidState(f.role)!.remaining).toBe(0);
    expect(getCupidState(f.role)!.choice).toEqual({ day: 1, pairIds: [5, 6] });
    expect(loversRecord(f.world)!.pairIds).toEqual([5, 6]);
    expect(livingOriginalLovers(f.world)).toBe(true);
    expect(projectLover(f.world, 5)!.partnerId).toBe(6);
  } else if (f.family === "hybrid") {
    expect(getHybridState(f.role)!.remaining).toBe(0);
    expect(getHybridState(f.role)!.choice).toEqual({ day: 1, targetId: 5 });
    expect(f.world.getComponent(1, COMPONENT.Victory)!.affiliations).toEqual([{ kind: "faction", faction: Camp.Good }]);
  } else {
    expect(getWolfBeautyState(f.role)!.targetId).toBe(5);
    expect(getWolfBeautyState(f.role)!.lastActedDay).toBe(1);
    expect(getWolfBeautyState(f.role)!.history).toEqual([{ day: 1, targetId: 5 }]);
    const charm = activeCharm(f.world, 1)!;
    expect(charm.targetId).toBe(5);
    expect(isCharmBindingCurrent(f.world, charm)).toBe(true);
  }
}
const factTypes: Record<Family, GameEvent["type"][]> = {
  cupid: ["cupid_lovers_chosen", "lover_recognized", "lover_recognized", "cupid_relation_resolved"],
  hybrid: ["hybrid_exemplar_chosen", "hybrid_affiliation_resolved"],
  wolf_beauty: ["charm_applied"],
};

test("each retired actor loses unpaid stage/rule admission; fresh actors and retired targets keep original data rules", async () => {
  for (const family of families) {
    const f = fixture(family);
    retireRoleExecution(f.role);
    const result = f.gateway.validateAndSanitize(f.world, 1, choice(family), { phase: Phase.Night, day: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(unavailable[family]);
    await run(f);
    expect(f.stats.requests).toBe(0);
    expect(f.stats.providers).toBe(0);
    unpaid(f);
    const fresh = fixture(family);
    retireRoleExecution(fresh.world.getComponent(5, COMPONENT.Role)!);
    expect(isRoleExecutionRetired(fresh.role)).toBe(false);
    await run(fresh);
    expect(fresh.stats.providers).toBe(1);
    expect(fresh.stats.receiverOK).toBe(true);
    paid(fresh);
    expect(fresh.events.map((event) => event.type)).toEqual(factTypes[family]);
  }
});

test("target capture and original request/provider getters reject before creating or delivering new work", async () => {
  for (const family of families) for (const point of ["targets", "builder", "provider", "getAction", "request_return"] as const) {
    const f = fixture(family), makeRequest = f.ctx.makeRequest;
    if (point === "targets") {
      const getAlive = f.world.getAliveEntityIds;
      Object.defineProperty(f.world, "getAliveEntityIds", { value: function (this: World) {
        const ids = getAlive.call(this);
        retireRoleExecution(f.role);
        return ids;
      } });
    }
    Object.defineProperty(f.ctx, "makeRequest", { get() {
      if (point === "builder") retireRoleExecution(f.role);
      return function (this: NightStageContext, ...args: Parameters<typeof makeRequest>) {
        const request = makeRequest.apply(this, args);
        if (point === "request_return") retireRoleExecution(f.role);
        return request;
      };
    } });
    if (point === "provider") Object.defineProperty(f.ctx, "actionProvider", { get() {
      retireRoleExecution(f.role);
      return f.provider;
    } });
    if (point === "getAction") {
      const getAction = f.provider.getAction;
      Object.defineProperty(f.provider, "getAction", { get() {
        retireRoleExecution(f.role);
        return getAction;
      } });
    }
    await run(f);
    expect(f.stats.requests).toBe(point === "request_return" || (family === "cupid" && (point === "provider" || point === "getAction")) ? 1 : 0);
    expect(f.stats.providers).toBe(0);
    unpaid(f);
  }
});

test("a valid provider reply cannot spend a captured actor retired during await", async () => {
  for (const family of families) {
    let f: Fixture;
    f = fixture(family, async () => { retireRoleExecution(f.role); return choice(family); });
    await run(f);
    expect(f.stats.requests).toBe(1);
    expect(f.stats.providers).toBe(1);
    expect(f.ctx.isCurrent()).toBe(true);
    unpaid(f);
  }
});

test("sanitized target getters after gateway current cannot cross the first unpaid write", async () => {
  for (const family of families) {
    const f = fixture(family), validate = f.gateway.validateAndSanitize;
    Object.defineProperty(f.gateway, "validateAndSanitize", { value: function (this: ToolGateway, ...args: Parameters<ToolGateway["validateAndSanitize"]>) {
      const result = validate.apply(this, args);
      f.trace.push("gateway");
      if (result.ok) {
        const key = family === "cupid" ? "first_id" : "target_id";
        Object.defineProperty(result.sanitizedCall!.args, key, { get() {
          f.trace.push("target");
          retireRoleExecution(f.role);
          return 5;
        } });
      }
      return result;
    } });
    await run(f);
    expect(f.trace).toEqual(["request", "provider", "gateway", "target"]);
    unpaid(f);
  }
});

test("Wolf Beauty's nullable reply cannot bypass captured retirement without a gateway call", async () => {
  let f: Fixture;
  f = fixture("wolf_beauty", async () => { retireRoleExecution(f.role); return null; });
  Object.defineProperty(f.gateway, "validateAndSanitize", { value() { throw new Error("unexpected_nullable_gateway"); } });
  await run(f);
  expect(f.stats.providers).toBe(1);
  unpaid(f);
});

test("Cupid prepares internal component callee and Reflect before refusal, while getter errors retain the same Error", async () => {
  for (const point of ["callee", "invoke", "throw"] as const) {
    const f = fixture("cupid"), original = f.world.addComponent,
      error = new Error("original_lovers_component_getter_failure"), trace: string[] = [],
      reflectDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply")!, reflectApply = Reflect.apply;
    const install = function (this: World, ...args: Parameters<World["addComponent"]>) {
      trace.push("write");
      return original.apply(this, args);
    };
    Object.defineProperty(f.world, "addComponent", { get() {
      trace.push("callee");
      if (point !== "invoke") retireRoleExecution(f.role);
      if (point === "throw") throw error;
      if (point === "invoke") Object.defineProperty(Reflect, "apply", { configurable: true, get() {
        trace.push("invoke");
        retireRoleExecution(f.role);
        return reflectApply;
      } });
      return install;
    } });
    try {
      if (point === "throw") await expect(run(f)).rejects.toBe(error);
      else await run(f);
    } finally { Object.defineProperty(Reflect, "apply", reflectDescriptor); }
    expect(trace).toEqual(point === "invoke" ? ["callee", "invoke"] : ["callee"]);
    unpaid(f);
  }
});

test("accepted relations finish after late retirement and retain publication errors without refunds", async () => {
  for (const family of families) for (const fail of [false, true]) {
    const f = fixture(family), error = new Error("original_relationship_fact_failure");
    Object.defineProperty(f.events, "push", { get() {
      retireRoleExecution(f.role);
      if (fail) throw error;
      return Array.prototype.push;
    } });
    if (fail) await expect(run(f)).rejects.toBe(error);
    else await run(f);
    expect(isRoleExecutionRetired(f.role)).toBe(true);
    paid(f);
    expect(f.events.map((event) => event.type)).toEqual(fail ? [] : factTypes[family]);
  }
});

test("default Lovers data binding remains void and avoids the controlled bind channel even for retired data", () => {
  const f = fixture("cupid"), original = f.world.addComponent;
  retireRoleExecution(f.role);
  let receiverOK = false;
  const install = function (this: World, ...args: Parameters<World["addComponent"]>) {
    receiverOK = this === f.world;
    return original.apply(this, args);
  };
  Object.defineProperty(f.world, "addComponent", { value: install });
  const reflectDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply")!;
  Object.defineProperty(Reflect, "apply", { configurable: true, get() { throw new Error("default_binding_must_not_read_reflect"); } });
  const record = Object.freeze({ actorId: 1, day: 1 as const, policy: "netease_2017_cupid_follows_lovers_v1" as const,
    pairIds: Object.freeze([5, 6]) as readonly [number, number], pairCamps: Object.freeze([Camp.Wolf, Camp.Good] as const),
    groupId: "cupid_lovers" as const, mixed: true });
  let output: void;
  try { output = bindLovers(f.world, record, [captureNightLife(f.world, 5)!, captureNightLife(f.world, 6)!]); }
  finally { Object.defineProperty(Reflect, "apply", reflectDescriptor); }
  expect(output).toBeUndefined();
  expect(receiverOK).toBe(true);
  expect(loversRecord(f.world)).toBe(record);
  expect(livingOriginalLovers(f.world)).toBe(true);
  expect(isRoleExecutionRetired(f.role)).toBe(true);
});


test("non-callable provider callee waits for the original builder result and preserves its earlier Error", async () => {
  for (const family of families) for (const point of ["builder_error", "provider_call"] as const) {
    const f = fixture(family), makeRequest = f.ctx.makeRequest,
      error = new Error("original_request_builder_failure");
    Object.defineProperty(f.provider, "getAction", { value: 17 });
    if (point === "builder_error") Object.defineProperty(f.ctx, "makeRequest", { value: function (this: NightStageContext, ...args: Parameters<typeof makeRequest>) {
      makeRequest.apply(this, args);
      throw error;
    } });
    if (point === "builder_error") await expect(run(f)).rejects.toBe(error);
    else await expect(run(f)).rejects.toBeInstanceOf(TypeError);
    expect(f.stats.requests).toBe(1);
    expect(f.stats.providers).toBe(0);
    expect(f.trace).toEqual(["request"]);
    unpaid(f);
  }
});
