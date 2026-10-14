/**
 * 单元测试负责四族原生／学习枪的数据身份、晚查询及结算付款失败前缀。
 * 输入为真实 Role／Alive／World、手写访问器与原学习函数；输出为独立字面预期的轨迹、引用和拒绝。
 * 原 getter／setter 故障对象只模拟调用边界，不扩生产 schema；不运行对局、模型或从结算算法推导预期。
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase } from "@ai-werewolf-arena/game-contract";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { DeathCause } from "../../../src/core/domain/deaths";
import { World } from "../../../src/core/domain/world";
import type { RoleInitContext } from "../../../src/game/mechanisms/roles/contracts";
import {
  createHunterState,
  createWolfKingState,
  setHunterState,
  getHunterState,
  createLearnedNativeGun,
  createMechanicalGunReader,
  createAwakenedGunReader,
  captureNativeGunStock,
  type LearnedNativeGun,
} from "../../../src/game/mechanisms/roles/native-death-gun-resources";
import { resolveNativeDeathShots } from "../../../src/game/mechanisms/roles/native-death-shot-settlement";
import {
  freshMechanicalState,
  setMechanicalState,
  getMechanicalState,
  learnMechanicalRole,
  advanceMechanicalNight,
} from "../../../src/game/mechanisms/roles/mechanical_wolf/state";
import {
  freshAwakenedState,
  setAwakenedState,
  getAwakenedState,
  learnAwakenedRole,
  activateAwakenedLearning,
} from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/state";

function shotWorld() {
  const world = new World("en"),
    actor = world.createEntity(),
    target = world.createEntity();
  const role = createRoleComponent(Role.Hunter, Camp.Good);
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Alive, createAliveComponent(false));
  world.addComponent(target, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  world.addComponent(target, COMPONENT.Alive, createAliveComponent(true));
  return { world, actor, target, role };
}

test("原生创建保配置重复读取、可选政策及同引用安装，不新增shape拒绝", () => {
  const trace: string[] = [];
  // 仅构造这些原工厂实际读取的字段；这是内存 getter 输入，不是新的公共板子接受政策。
  const ctx = {
    get boardConfig() {
      trace.push("board");
      return {
        get hunter() {
          trace.push("hunter");
          return {
            get deathActionPolicy() {
              trace.push("policy");
              return "awa_knife_or_exile_v1";
            },
          };
        },
      };
    },
  } as unknown as Pick<RoleInitContext, "boardConfig">;
  const state = createHunterState(ctx),
    role = createRoleComponent(Role.Hunter, Camp.Good);
  expect(trace).toEqual(["board", "hunter", "policy", "board", "hunter", "policy"]);
  expect(state).toEqual({ canShoot: true, deathActionPolicy: "awa_knife_or_exile_v1" });
  expect(setHunterState(role, state)).toBe(state);
  expect(getHunterState(role)).toBe(state);
  expect(createWolfKingState({})).toEqual({ canShoot: true });
  expect(Object.isFrozen(state)).toBe(false);
  const first = createLearnedNativeGun(),
    second = createLearnedNativeGun();
  expect(first).toEqual({ kind: "hunter", canShoot: true, armed: false });
  expect(first).not.toBe(second);
});

test("学习枪每次hook独立捕获、查询晚裸调用，机械和觉醒保各自复验字段", () => {
  const mechanical = createRoleComponent(Role.MechanicalWolf, Camp.Wolf);
  const ms = setMechanicalState(mechanical, freshMechanicalState());
  learnMechanicalRole(ms, 3, Role.Hunter, 1);
  advanceMechanicalNight(ms, 2);
  const trace: unknown[] = [];
  const reader = createMechanicalGunReader({
    get getMechanicalState() {
      trace.push("lookup");
      return function (this: unknown, role: ReturnType<typeof createRoleComponent> | undefined) {
        trace.push(this);
        return getMechanicalState(role);
      };
    },
  });
  expect(trace).toEqual([]);
  const gun = ms.learned!.skill;
  expect(reader(mechanical)).toBe(gun as LearnedNativeGun);
  expect(trace).toEqual(["lookup", undefined]);
  (ms as { learned: typeof ms.learned }).learned = { ...ms.learned! };
  expect(reader(mechanical)).toBeUndefined();
  expect(createMechanicalGunReader({ getMechanicalState })(mechanical)).toBe(gun as LearnedNativeGun);
  const awakened = createRoleComponent(Role.AwakenedHiddenWolf, Camp.Wolf);
  const as = setAwakenedState(awakened, freshAwakenedState());
  learnAwakenedRole(as, 3, Role.Hunter, 1);
  activateAwakenedLearning(as, 1);
  const awReader = createAwakenedGunReader({ getAwakenedState });
  expect(awReader(awakened)).toBe(as.learned!.skill as LearnedNativeGun);
  (as.learned as { activationNight: number | null }).activationNight = 2;
  expect(awReader(awakened)).toBeUndefined();
  expect(gun).toEqual({ kind: "hunter", canShoot: true, armed: true });
});

test("审计stock在sources之前晚捕获，await后stock撤权先于角色复验", async () => {
  const f = shotWorld(),
    state = setHunterState(f.role, { canShoot: true }),
    events: GameEvent[] = [];
  const trace: unknown[] = [],
    failure = new Error("demon_hunter_native_hunter_stock_revoked");
  const sources = {
    get [f.actor]() {
      trace.push("sources");
      return [DeathCause.Exile];
    },
  };
  const stock = {
    consume() {
      trace.push("consume");
    },
    isCurrent() {
      trace.push("stock.current");
      return false;
    },
  };
  const rules = {
    role: Role.Hunter,
    state: getHunterState,
    permits: () => true,
    get openHunterStock() {
      trace.push("command.lookup");
      return function (this: unknown, ...args: unknown[]) {
        trace.push(this, "command.call");
        expect(args).toEqual([f.world, f.actor, state]);
        return stock;
      };
    },
    shotEvent: (): GameEvent => ({
      timestamp: 1,
      type: "hunter_shot",
      payload: { hunterId: f.actor, targetId: f.target },
    }),
  };
  await expect(
    resolveNativeDeathShots(
      f.world,
      [f.actor],
      sources,
      async () => {
        trace.push("choose");
        Object.defineProperty(f.role, "privateState", {
          get() {
            throw new Error("must_not_revalidate_after_stock");
          },
        });
        return { kind: "invalid" };
      },
      events,
      rules,
    ),
  ).rejects.toThrow(failure);
  expect(trace).toEqual([
    "command.lookup",
    undefined,
    "command.call",
    "sources",
    "choose",
    "stock.current",
  ]);
  expect(events).toEqual([]);
  expect(state.canShoot).toBe(true);
  const world = new World("en");
  expect(
    captureNativeGunStock(
      Role.WolfKing,
      {
        get openHunterStock(): never {
          throw new Error("must_not_lookup_hunter_command");
        },
      },
      world,
      1,
      state,
    ),
  ).toBeNull();
});

test("有效命中先付款再取保护方法，保护lookup失败不退款或产生提案事实", async () => {
  const f = shotWorld(),
    trace: string[] = [],
    events: GameEvent[] = [];
  let canShoot = true;
  const state = setHunterState(f.role, {
    get canShoot() {
      return canShoot;
    },
    set canShoot(value: boolean) {
      trace.push("consume");
      canShoot = value;
    },
  });
  const permit = f.world.openDeathAction(f.actor, "shoot", Phase.Voting, 2);
  const failure = new Error("literal_protection_lookup_failed");
  try {
    await expect(
      resolveNativeDeathShots(
        f.world,
        [f.actor],
        { [f.actor]: [DeathCause.Exile] },
        async () => ({ kind: "shot", targetId: f.target, deathActionId: permit.id }),
        events,
        {
          role: Role.Hunter,
          state: getHunterState,
          permits: () => true,
          openHunterStock: () => null,
          shotEvent: () => {
            trace.push("event");
            return {
              timestamp: 1,
              type: "hunter_shot",
              payload: { hunterId: f.actor, targetId: f.target },
            };
          },
        },
        {
          nightEffect: true,
          get blocksNightShot(): never {
            trace.push("protection");
            throw failure;
          },
        },
      ),
    ).rejects.toThrow(failure);
  } finally {
    permit.close();
  }
  expect(trace).toEqual(["consume", "protection"]);
  expect(state.canShoot).toBe(false);
  expect(events).toEqual([]);
  expect(f.world.getComponent(f.target, COMPONENT.Alive)!.alive).toBe(true);
  expect(f.world.activeDeathActionCount).toBe(0);
});
