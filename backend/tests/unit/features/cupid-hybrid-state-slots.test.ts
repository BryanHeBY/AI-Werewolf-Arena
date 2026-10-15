/**
 * 单元测试验证丘比特／混血儿槽的初始化读取与真实选择失败前缀。
 * 输入为原角色、惰性政策 getter、真实夜阶段及抛错的字段／组件写入；输出为手写字面轨迹、库存、关系和原引用断言。
 * 局部 bootstrap／网关执行原选择，不运行完整周期或模型；绑定关系、消费选择与安装 Victory 不是可回滚事务。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  type GameEvent,
  type ToolCall,
  type World,
} from "../../../src/domain";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import type {
  RoleInitializationComponent,
  RoleInitContext,
} from "../../../src/rulesets/roles/contracts";
import { installCupidState, getCupidState } from "../../../src/features/cupid/state-slot";
import { getHybridState } from "../../../src/features/hybrid/state-slot";
import { CUPID_STAGE } from "../../../src/features/cupid/night-stage";
import { HYBRID_STAGE, hasHybridNightCommit } from "../../../src/features/hybrid/night-stage";
import { hasCupidNightCommit, loversRecord } from "../../../src/features/cupid/relation";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { nightStageContext } from "../../support/builders/night-stage-context";
import { foxBoard } from "../../support/features/cursed-fox/builders/scenario";

function fixture(kind: Role.Cupid | Role.Hybrid) {
  const roles = [kind, Role.Hunter, Role.Wolf, Role.Villager, Role.Wolf, Role.Villager];
  return bootstrapGame(foxBoard(roles), { fixedRoles: roles });
}

function context(game: ReturnType<typeof fixture>, events: GameEvent[], action: ToolCall) {
  const factory = new GameActionRequestFactory(game.world, events, 1);
  return nightStageContext({
    world: game.world,
    events,
    currentDay: () => 1,
    isCurrent: () => true,
    getAliveByRole: (kind) =>
      game.world
        .getAliveEntityIds()
        .filter((id) => game.world.getComponent(id, COMPONENT.Role)?.role === kind),
    actionProvider: { getAction: async () => action },
    makeRequest: (actorId, allowedTools, extras) =>
      factory.create({
        actorId,
        phase: Phase.Night,
        allowedTools,
        stage: extras.stage,
        requiresAction: extras.requiresAction ?? true,
        summary: "Offline",
        context: extras,
      }),
  });
}

test("Cupid init captures the original assignment container before a late policy failure", () => {
  const trace: string[] = [],
    error = new Error("late_policy_failure");
  const role = createRoleComponent(Role.Cupid) as RoleInitializationComponent;
  const container = {};
  Object.defineProperty(container, "cupid", {
    get() {
      trace.push("slot:get");
      return undefined;
    },
    set() {
      trace.push("slot:set");
    },
    configurable: true,
  });
  Object.defineProperty(role, "privateState", {
    get() {
      trace.push("container");
      return container;
    },
    configurable: true,
  });
  const ctx: Pick<RoleInitContext, "boardConfig"> = {
    get boardConfig() {
      trace.push("board");
      return {
        get cupid() {
          trace.push("cupid");
          return {
            get policy(): "netease_2017_cupid_follows_lovers_v1" {
              trace.push("policy");
              throw error;
            },
          };
        },
      } as RoleInitContext["boardConfig"];
    },
  };
  expect(() => installCupidState(role, ctx)).toThrow(error);
  expect(trace).toEqual(["container", "slot:get", "container", "board", "cupid", "policy"]);
  expect(Object.getOwnPropertyDescriptor(container, "cupid")?.set).toBeDefined();
});

test("Cupid choice setter failure preserves the committed relation and debit before membership or facts", async () => {
  const game = fixture(Role.Cupid),
    events: GameEvent[] = [],
    trace: string[] = [];
  const actor = game.world.getComponent(1, COMPONENT.Role)!,
    state = getCupidState(actor)!;
  const victories = game.world
    .entityIds()
    .map((id) => game.world.getComponent(id, COMPONENT.Victory));
  const error = new Error("choice_write_failure");
  let remaining = 1;
  Object.defineProperty(state, "remaining", {
    get: () => remaining,
    set(value: number) {
      remaining = value;
      trace.push(`remaining:${value}`);
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(state, "choice", {
    get: () => null,
    set() {
      trace.push("choice");
      throw error;
    },
    enumerable: true,
    configurable: true,
  });
  const add = game.world.addComponent;
  Object.defineProperty(game.world, "addComponent", {
    value(this: World, id: number, name: string, data: unknown) {
      trace.push(`add:${name}`);
      return Reflect.apply(add, this, [id, name, data]);
    },
    configurable: true,
  });
  await expect(
    CUPID_STAGE.execute(
      context(game, events, {
        name: "choose_lovers",
        args: { first_id: 1, second_id: 3 },
      }),
    ),
  ).rejects.toBe(error);
  expect(trace).toEqual([`add:${COMPONENT.Lovers}`, "remaining:0", "choice"]);
  expect(hasCupidNightCommit(game.world, 1)).toBe(true);
  expect(loversRecord(game.world)?.pairIds).toEqual([1, 3]);
  expect(state.remaining).toBe(0);
  expect(state.choice).toBeNull();
  expect(game.world.getComponent(1, COMPONENT.Role)).toBe(actor);
  game.world.entityIds().forEach((id, index) => {
    expect(game.world.getComponent(id, COMPONENT.Victory)).toBe(victories[index]);
  });
  expect(events).toEqual([]);
});

test("Hybrid membership install failure preserves both owned writes before the night commit or facts", async () => {
  const game = fixture(Role.Hybrid),
    events: GameEvent[] = [],
    trace: string[] = [];
  const actor = game.world.getComponent(1, COMPONENT.Role)!,
    state = getHybridState(actor)!;
  const originalVictory = game.world.getComponent(1, COMPONENT.Victory),
    error = new Error("membership_write_failure");
  let remaining = 1,
    choice: { day: number; targetId: number } | null = null;
  Object.defineProperty(state, "remaining", {
    get: () => remaining,
    set(value: number) {
      remaining = value;
      trace.push(`remaining:${value}`);
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(state, "choice", {
    get: () => choice,
    set(value: { day: number; targetId: number }) {
      choice = value;
      trace.push("choice");
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(game.world, "addComponent", {
    value(id: number, name: string, data: unknown) {
      trace.push(`add:${id}:${name}`);
      // 真实阶段只在两字段提交后到达此组件安装；不为测试新增生产钩子。
      if (id === 1 && name === COMPONENT.Victory) {
        expect(data).toMatchObject({ affiliations: [{ kind: "faction", faction: Camp.Wolf }] });
        throw error;
      }
      throw new Error("unexpected_component_write");
    },
    configurable: true,
  });
  await expect(
    HYBRID_STAGE.execute(
      context(game, events, {
        name: "choose_exemplar",
        args: { target_id: 3 },
      }),
    ),
  ).rejects.toBe(error);
  expect(trace).toEqual(["remaining:0", "choice", `add:1:${COMPONENT.Victory}`]);
  expect(state.remaining).toBe(0);
  expect(state.choice).toEqual({ day: 1, targetId: 3 });
  expect(hasHybridNightCommit(game.world, 1)).toBe(false);
  expect(game.world.getComponent(1, COMPONENT.Victory)).toBe(originalVictory);
  expect(game.world.getComponent(1, COMPONENT.Role)).toBe(actor);
  expect(events).toEqual([]);
});
