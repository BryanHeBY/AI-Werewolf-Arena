/**
 * 单元验证两类商人的未付执行退休边界，输入为真实合法六人板、可等待 provider 和明确 getter／sink 故障。
 * 独立字面库存、关窗、提案、资源与同 Error 断言区分首写之前拒绝和已付前缀继续，不复制生产资格谓词。
 * 每例只执行本商人阶段与公开 gateway／资源查询，不运行完整夜、模型或历史 F04／F05 已绿用例。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Camp,
  COMPONENT,
  Phase,
  Role,
  WinCondition,
  type GameEvent,
  type ToolCall,
} from "../../../src/domain";
import {
  retireRoleExecution,
  isRoleExecutionRetired,
} from "../../../src/domain/role-execution-authority";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { nightStageContext } from "../../support/builders/night-stage-context";
import type { NightStageContext } from "../../../src/engine/night/contracts";
import {
  MIRACLE_MERCHANT_STAGE,
  hasMerchantNightCommit,
} from "../../../src/features/miracle-merchant/night-stage";
import {
  BLACK_MARKET_TRADE_STAGE,
  hasBlackMarketNightCommit,
} from "../../../src/features/black-market-merchant/night-stage";
import { getMerchantState } from "../../../src/features/miracle-merchant/state";
import { getBlackMarketState } from "../../../src/features/black-market-merchant/state";
import { allNightAbilities } from "../../../src/features/night-abilities/abilities";
import { allDeathGuns } from "../../../src/features/death-actions/death-abilities";

type Family = "miracle" | "black";
const kind = (family: Family) =>
  family === "miracle" ? Role.MiracleMerchant : Role.BlackMarketMerchant;
const stage = (family: Family) =>
  family === "miracle" ? MIRACLE_MERCHANT_STAGE : BLACK_MARKET_TRADE_STAGE;
function choose(family: Family, target: number, gun = false): ToolCall {
  return family === "miracle"
    ? { name: "bestow_ability", args: { target_id: target, skill: "check" } }
    : { name: "black_market_trade", args: { target_id: target, skill: gun ? "gun" : "check" } };
}

/** 两族各用其实际支持的合法六人板；原 Camp／库存由 bootstrap 创建，不挂 Role.camp 或测试镜像。 */
function fixture(family: Family) {
  const roles = [kind(family), Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];
  const game = bootstrapGame(
    {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((r) => r === role).length,
      })),
      winConditions: [WinCondition.SlaughterCity],
      selfDestruct: { enabledWindows: [] },
    },
    { fixedRoles: roles },
  );
  const events: GameEvent[] = [],
    actor = game.world.getComponent(1, COMPONENT.Role)!;
  const stock = family === "miracle" ? getMerchantState(actor)! : getBlackMarketState(actor)!;
  const factory = new GameActionRequestFactory(game.world, events, 1);
  const ctx = nightStageContext({
    world: game.world,
    events,
    actionProvider: { getAction: async () => choose(family, 2) },
    getAliveByRole: (role) =>
      game.world
        .getAliveEntityIds()
        .filter((id) => game.world.getComponent(id, COMPONENT.Role)?.role === role),
    makeRequest: (actorId, allowedTools, extra) =>
      factory.create({
        actorId,
        allowedTools,
        phase: Phase.Night,
        stage: extra.stage,
        requiresAction: extra.requiresAction ?? true,
        summary: { key: "request.summary.night_action" },
        context: extra,
      }),
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
      merchantBacklashes: [],
      blackMarketBacklashes: [],
    },
  });
  return { game, events, actor, stock, ctx };
}
const committed = (family: Family, f: ReturnType<typeof fixture>) =>
  family === "miracle"
    ? hasMerchantNightCommit(f.game.world, 1)
    : hasBlackMarketNightCommit(f.game.world, 1);

for (const family of ["miracle", "black"] as const) {
  test(`${family}: retired original opens no request; fresh actor may trade with a retired pure Wolf target`, async () => {
    const f = fixture(family);
    let providers = 0;
    f.ctx.actionProvider.getAction = async () => {
      providers++;
      return choose(family, 2);
    };
    retireRoleExecution(f.actor);
    const result = f.ctx.toolGateway.validateAndSanitize(f.game.world, 1, choose(family, 2), {
      phase: Phase.Night,
      day: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("merchant_unavailable");
    await stage(family).execute(f.ctx);
    expect(providers).toBe(0);
    expect(f.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
    expect(f.events).toEqual([]);
    expect(committed(family, f)).toBe(false);

    // 换对象并不清除旧对象墓碑；新对象仍走全部真实规则，退休目标不变成全局数据过滤。
    const fresh = { ...f.actor };
    f.game.world.addComponent(1, COMPONENT.Role, fresh);
    retireRoleExecution(f.game.world.getComponent(2, COMPONENT.Role)!);
    await stage(family).execute(f.ctx);
    expect(isRoleExecutionRetired(f.actor)).toBe(true);
    expect(isRoleExecutionRetired(fresh)).toBe(false);
    expect(providers).toBe(1);
    expect(f.stock).toEqual({
      remaining: 0,
      closedDay: 1,
      choice: { day: 1, targetId: 2, skill: "check" },
    });
    expect(f.game.world.getComponent(1, COMPONENT.Camp)!.camp).toBe(Camp.Good);
    expect(committed(family, f)).toBe(true);
  });

  test(`${family}: true suspended null response and no-target capture cannot close a retired unpaid day`, async () => {
    const f = fixture(family);
    let finish!: (call: ToolCall | null) => void,
      providers = 0;
    f.ctx.actionProvider.getAction = () => {
      providers++;
      return new Promise<ToolCall | null>((resolve) => {
        finish = resolve;
      });
    };
    const pending = stage(family).execute(f.ctx);
    expect(providers).toBe(1);
    retireRoleExecution(f.actor);
    finish(null);
    await pending;
    expect(f.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
    expect(committed(family, f)).toBe(false);
    expect(f.events).toEqual([]);

    const noTargets = fixture(family);
    noTargets.ctx.getAliveByRole = () => [1];
    noTargets.game.world.getAliveEntityIds = () => {
      retireRoleExecution(noTargets.actor);
      return [1];
    };
    noTargets.ctx.actionProvider.getAction = async () => {
      throw new Error("no_target_provider_must_not_open");
    };
    await stage(family).execute(noTargets.ctx);
    expect(noTargets.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
    expect(committed(family, noTargets)).toBe(false);
    expect(noTargets.events).toEqual([]);
  });

  test(`${family}: provider/builder getter or builder body retirement prevents the next unpaid call`, async () => {
    for (const point of ["provider", "get_action", "builder_getter", "builder_body"] as const) {
      const f = fixture(family);
      let requests = 0,
        providers = 0;
      const originalBuilder = f.ctx.makeRequest;
      const builder: NightStageContext["makeRequest"] = function (
        this: NightStageContext,
        ...args
      ) {
        requests++;
        expect(this).toBe(f.ctx);
        const request = originalBuilder.apply(this, args);
        if (point === "builder_body") retireRoleExecution(f.actor);
        return request;
      };
      f.ctx.makeRequest = builder;
      const getAction: NightStageContext["actionProvider"]["getAction"] = async function (
        this: NightStageContext["actionProvider"],
      ) {
        providers++;
        expect(this).toBe(provider);
        return choose(family, 2);
      };
      const provider = { getAction };
      if (point === "get_action")
        Object.defineProperty(provider, "getAction", {
          get() {
            retireRoleExecution(f.actor);
            return getAction;
          },
        });
      if (point === "provider")
        Object.defineProperty(f.ctx, "actionProvider", {
          get() {
            retireRoleExecution(f.actor);
            return provider;
          },
        });
      else {
        f.ctx.actionProvider = provider;
        if (point === "builder_getter")
          Object.defineProperty(f.ctx, "makeRequest", {
            get() {
              retireRoleExecution(f.actor);
              return builder;
            },
          });
      }
      await stage(family).execute(f.ctx);
      expect(requests).toBe(point === "builder_body" ? 1 : 0);
      expect(providers).toBe(0);
      expect(f.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
      expect(committed(family, f)).toBe(false);
      expect(f.events).toEqual([]);
    }
  });

  test(`${family}: sanitized args and the last accepted target getter retire before Wolf stock payment`, async () => {
    for (const point of ["args", "target"] as const) {
      const f = fixture(family),
        target = f.game.world.getComponent(2, COMPONENT.Role)!;
      if (point === "args") {
        const validate = f.ctx.toolGateway.validateAndSanitize.bind(f.ctx.toolGateway);
        f.ctx.toolGateway.validateAndSanitize = (world, actorId, call, context) => {
          const result = validate(world, actorId, call, context);
          if (result.ok && result.sanitizedCall)
            Object.defineProperty(result.sanitizedCall.args, "target_id", {
              get() {
                retireRoleExecution(f.actor);
                return 2;
              },
            });
          return result;
        };
      } else {
        const data = target.privateState;
        f.ctx.actionProvider.getAction = async () => {
          Object.defineProperty(target, "privateState", {
            get() {
              retireRoleExecution(f.actor);
              return data;
            },
          });
          return choose(family, 2);
        };
      }
      await stage(family).execute(f.ctx);
      expect(f.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
      expect(committed(family, f)).toBe(false);
      expect(f.ctx.state.merchantBacklashes).toEqual([]);
      expect(f.ctx.state.blackMarketBacklashes).toEqual([]);
      expect(f.events).toEqual([]);
    }
    // 单独走真实规则成功尾：isAliveTarget 的原 getter 本身退休源，不能只靠阶段 after-validator 守卫掩盖规则遗漏。
    const rule = fixture(family),
      targetLife = rule.game.world.getComponent(2, COMPONENT.Alive)!;
    const descriptor = Object.getOwnPropertyDescriptor(targetLife, "alive")!;
    Object.defineProperty(targetLife, "alive", {
      ...descriptor,
      get() {
        retireRoleExecution(rule.actor);
        return true;
      },
    });
    const result = rule.ctx.toolGateway.validateAndSanitize(rule.game.world, 1, choose(family, 2), {
      phase: Phase.Night,
      day: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("merchant_unavailable");
    expect(rule.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
    expect(rule.events).toEqual([]);
  });

  test(`${family}: throwing target getter keeps the same Error before the new retirement tail`, async () => {
    const f = fixture(family),
      target = f.game.world.getComponent(2, COMPONENT.Role)!;
    const failure = new Error("literal_target_read_failure");
    f.ctx.actionProvider.getAction = async () => {
      Object.defineProperty(target, "privateState", {
        get() {
          retireRoleExecution(f.actor);
          throw failure;
        },
      });
      return choose(family, 2);
    };
    await expect(stage(family).execute(f.ctx)).rejects.toBe(failure);
    expect(f.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
    expect(committed(family, f)).toBe(false);
    expect(f.events).toEqual([]);
  });

  test(`${family}: accepted Good resource retires the source but completes merchant stock and facts`, async () => {
    const f = fixture(family),
      append = f.events.push.bind(f.events);
    f.ctx.actionProvider.getAction = async () => choose(family, 6, family === "black");
    f.events.push = (...rows) => {
      const result = append(...rows);
      if (
        rows.some(
          (row) =>
            row.type === (family === "miracle" ? "ability_changed" : "death_ability_changed"),
        )
      )
        retireRoleExecution(f.actor);
      return result;
    };
    await stage(family).execute(f.ctx);
    expect(isRoleExecutionRetired(f.actor)).toBe(true);
    expect(f.stock).toEqual({
      remaining: 0,
      closedDay: 1,
      choice: { day: 1, targetId: 6, skill: family === "miracle" ? "check" : "gun" },
    });
    expect(committed(family, f)).toBe(true);
    expect(f.events.map((row) => row.type)).toEqual(
      family === "miracle"
        ? ["ability_changed", "merchant_trade_committed", "merchant_trade_resolved"]
        : ["death_ability_changed", "black_market_trade_committed", "black_market_trade_resolved"],
    );
    const target = f.game.world.getComponent(6, COMPONENT.Role)!;
    if (family === "miracle")
      expect(allNightAbilities(target)).toMatchObject([
        { id: "gift:miracle", uses: 0, maxUses: 1 },
      ]);
    else
      expect(allDeathGuns(target)).toMatchObject([
        { kind: "gun", remaining: 1, armedOnNight: null },
      ]);
  });

  test(`${family}: Good argument getters retire the captured source before grant, including another real World`, async () => {
    for (const point of ["world", "events"] as const) {
      const f = fixture(family),
        other = fixture(family),
        target = f.game.world.getComponent(6, COMPONENT.Role)!;
      const originalData = target.privateState;
      let prepared = false,
        argumentReads = 0;
      f.ctx.actionProvider.getAction = async () => {
        // 只在原目标末字段复验后激活故障；原 after-await／gateway 当前性查询仍见实际原 World。
        Object.defineProperty(target, "privateState", {
          get() {
            prepared = true;
            return originalData;
          },
        });
        if (point === "world")
          Object.defineProperty(f.ctx, "world", {
            get() {
              if (prepared) {
                argumentReads++;
                retireRoleExecution(f.actor);
                return other.game.world;
              }
              return f.game.world;
            },
          });
        else
          Object.defineProperty(f.ctx, "events", {
            get() {
              if (prepared) {
                argumentReads++;
                retireRoleExecution(f.actor);
              }
              return f.events;
            },
          });
        return choose(family, 6, family === "black");
      };
      await stage(family).execute(f.ctx);
      expect(argumentReads).toBeGreaterThan(0);
      expect(isRoleExecutionRetired(f.actor)).toBe(true);
      expect(f.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
      expect(other.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
      expect(allNightAbilities(target)).toEqual([]);
      expect(allDeathGuns(target)).toEqual([]);
      const otherTarget = other.game.world.getComponent(6, COMPONENT.Role)!;
      expect(allNightAbilities(otherTarget)).toEqual([]);
      expect(allDeathGuns(otherTarget)).toEqual([]);
      expect(committed(family, f)).toBe(false);
      expect(committed(family, other)).toBe(false);
      expect(f.events).toEqual([]);
      expect(other.events).toEqual([]);
    }
  });

  test(`${family}: Wolf first inventory write may retire the source without revoking the accepted backlash`, async () => {
    const f = fixture(family);
    let remaining = 1;
    Object.defineProperty(f.stock, "remaining", {
      enumerable: true,
      configurable: true,
      get: () => remaining,
      set(value: number) {
        remaining = value;
        retireRoleExecution(f.actor);
      },
    });
    await stage(family).execute(f.ctx);
    expect(isRoleExecutionRetired(f.actor)).toBe(true);
    expect(f.stock).toEqual({
      remaining: 0,
      closedDay: 1,
      choice: { day: 1, targetId: 2, skill: "check" },
    });
    expect(committed(family, f)).toBe(true);
    const backlash =
      family === "miracle"
        ? f.ctx.state.merchantBacklashes![0]
        : f.ctx.state.blackMarketBacklashes![0];
    expect(backlash.target.id).toBe(1);
    expect(backlash.isCurrent()).toBe(true);
    expect(f.events.map((row) => row.type)).toEqual(
      family === "miracle"
        ? ["merchant_trade_committed", "merchant_trade_resolved"]
        : ["black_market_trade_committed", "black_market_trade_resolved"],
    );
    if (family === "black") {
      f.game.world.getComponent(1, COMPONENT.Alive)!.alive = false;
      expect(backlash.isCurrent()).toBe(true);
    }
  });

  test(`${family}: late transaction fact failure keeps paid stock, accepted target resource and the same Error`, async () => {
    const f = fixture(family),
      failure = new Error("literal_paid_fact_failure"),
      append = f.events.push.bind(f.events);
    f.ctx.actionProvider.getAction = async () => choose(family, 6);
    f.events.push = (...rows) => {
      if (
        rows.some(
          (row) =>
            row.type ===
            (family === "miracle" ? "merchant_trade_committed" : "black_market_trade_committed"),
        )
      ) {
        retireRoleExecution(f.actor);
        throw failure;
      }
      return append(...rows);
    };
    await expect(stage(family).execute(f.ctx)).rejects.toBe(failure);
    expect(f.stock).toEqual({
      remaining: 0,
      closedDay: 1,
      choice: { day: 1, targetId: 6, skill: "check" },
    });
    expect(committed(family, f)).toBe(true);
    expect(allNightAbilities(f.game.world.getComponent(6, COMPONENT.Role)!)).toHaveLength(1);
    expect(f.events.map((row) => row.type)).toEqual(["ability_changed"]);
    expect(isRoleExecutionRetired(f.actor)).toBe(true);
  });
}

test("black: final no-target fallback may retire the source and must not close an unpaid day", async () => {
  const f = fixture("black"),
    original = f.game.world.getAliveEntityIds.bind(f.game.world);
  let scans = 0,
    providers = 0;
  f.ctx.getAliveByRole = () => [1];
  f.game.world.getAliveEntityIds = () => {
    if (++scans === 4) {
      retireRoleExecution(f.actor);
      return [1];
    }
    return original();
  };
  f.ctx.actionProvider.getAction = async () => {
    providers++;
    return { name: "speak", args: { text: "literal_wrong_trade_tool" } };
  };
  await BLACK_MARKET_TRADE_STAGE.execute(f.ctx);
  expect(providers).toBe(3);
  expect(scans).toBe(4);
  expect(f.stock).toEqual({ remaining: 1, closedDay: null, choice: null });
  expect(hasBlackMarketNightCommit(f.game.world, 1)).toBe(false);
  expect(f.events).toEqual([]);
});
