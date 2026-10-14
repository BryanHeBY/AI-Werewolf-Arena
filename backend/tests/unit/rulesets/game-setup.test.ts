/**
 * 单元测试验证开局组合的现场读取、构造失败前缀及 await 后取消短路。
 * 输入为真实空 World、真实盗贼牌库／野孩子绑定和手写抛错查询；输出依据字面轨迹与原状态。
 * 机制执行及 finally 关闭使用原 owner，不运行整局或模型，不用待测函数生成预期或模拟许可。
 */
import { expect, test, spyOn } from "bun:test";
import { Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { prepareGameSetup, type GameSetupRuntime } from "../../../src/rulesets/game-setup";
import {
  installInitialIdentityDeal,
  initialIdentitySetupReady,
} from "../../../src/game/mechanisms/roles/initial_identity/deal";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  wildChildBinding,
  hasActiveWildChild,
} from "../../../src/game/mechanisms/roles/wild_child/lifecycle";
import { foxBoard } from "../../support/features/cursed-fox/builders/scenario";
import { WildChildSetupWindow } from "../../../src/game/mechanisms/roles/wild_child/setup-ports";

/** 测试调用方只消费组合交还的原窗口 Promise，完成值本身不再构成等待。 */
async function finishSetup(...args: Parameters<typeof prepareGameSetup>): Promise<boolean> {
  const sequence = prepareGameSetup(...args);
  let step = sequence.next();
  while (!step.done) step = sequence.next(await step.value);
  return step.value;
}

function unreadRuntime(world: World, trace: string[]): GameSetupRuntime {
  return {
    world() {
      trace.push("world");
      return world;
    },
    toolGateway() {
      trace.push("gateway");
      throw new Error("unexpected_gateway");
    },
    events() {
      trace.push("events");
      throw new Error("unexpected_events");
    },
    config() {
      trace.push("config");
      throw new Error("unexpected_config");
    },
  };
}

test("ready setup checks four live Worlds and does not call current at the successful tail", async () => {
  const trace: string[] = [];
  const ready = await finishSetup(
    unreadRuntime(new World(), trace),
    {
      async getAction() {
        throw new Error("unexpected_provider");
      },
    },
    1,
    () => {
      trace.push("current");
      return false;
    },
  );
  expect(ready).toBe(true);
  expect(trace).toEqual(["world", "world", "world", "world"]);
});

test("an initial constructor argument failure preserves only the earlier reads and pending deal", async () => {
  const world = new World(),
    trace: string[] = [],
    failure = new Error("original_gateway_failure");
  installInitialIdentityDeal(world, [Role.Villager, Role.Villager], []);
  const runtime = unreadRuntime(world, trace);
  runtime.toolGateway = () => {
    trace.push("gateway");
    throw failure;
  };
  await expect(
    finishSetup(
      runtime,
      {
        async getAction() {
          throw new Error("unexpected_provider");
        },
      },
      1,
      () => {
        trace.push("current");
        return true;
      },
    ),
  ).rejects.toBe(failure);
  expect(trace).toEqual(["world", "world", "gateway"]);
  expect(initialIdentitySetupReady(world)).toBe(false);
});

test("a real Wild Child cancellation stops after its own current check and preserves lifecycle closure", async () => {
  const roles = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
  const config = foxBoard(roles),
    game = bootstrapGame(config, { fixedRoles: roles });
  const trace: string[] = [],
    events: GameEvent[] = [],
    gateway = new ToolGateway();
  let active = true;
  const ready = await finishSetup(
    {
      world() {
        trace.push("world");
        return game.world;
      },
      toolGateway() {
        trace.push("gateway");
        return gateway;
      },
      events() {
        trace.push("events");
        return events;
      },
      config() {
        trace.push("config");
        return game.boardConfig;
      },
    },
    {
      async getAction() {
        trace.push("provider");
        active = false;
        return { name: "choose_wild_model", args: { target_id: 2 } };
      },
    },
    1,
    () => {
      trace.push("current");
      return active;
    },
  );
  expect(ready).toBe(false);
  // 原请求绑定也会复验当前性；取消后的窗口复验只读一次，组合的 OR 不再调用它。
  expect(trace).toEqual([
    "world",
    "world",
    "world",
    "gateway",
    "events",
    "config",
    "current",
    "current",
    "current",
    "provider",
    "current",
  ]);
  expect(wildChildBinding(game.world)?.setup).toBe("cancelled");
  expect(hasActiveWildChild(game.world)).toBe(false);
  expect(events).toEqual([]);
});

test("synchronous setup has no microtask boundary when every step is ready", async () => {
  const trace: string[] = [];
  queueMicrotask(() => trace.push("queued"));
  const sequence = prepareGameSetup(
    unreadRuntime(new World(), trace),
    {
      async getAction() {
        throw new Error("unexpected_provider");
      },
    },
    1,
    () => {
      trace.push("current");
      return true;
    },
  );
  expect(trace).toEqual([]);
  expect(sequence.next()).toEqual({ done: true, value: true });
  trace.push("complete");
  expect(trace).toEqual(["world", "world", "world", "world", "complete"]);
  await Promise.resolve();
  expect(trace.at(-1)).toBe("queued");
});

test("a yielded original window resumes guards synchronously without an extra completion Promise", async () => {
  const roles = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
  const game = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  const trace: string[] = [],
    events: GameEvent[] = [],
    gateway = new ToolGateway();
  const provider = {
    async getAction() {
      return null;
    },
  };
  const current = () => {
    trace.push("current");
    return true;
  };
  let release!: (value: boolean) => void;
  const originalPromise = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  // 仅替换窗口结果来观察组合的暂停边界；不模拟选择规则、授权或库存提交。
  const spy = spyOn(WildChildSetupWindow.prototype, "execute").mockImplementation(function (
    this: WildChildSetupWindow,
    config,
    actualProvider,
    day,
    isCurrent,
  ) {
    trace.push("execute");
    expect(config).toBe(game.boardConfig);
    expect(actualProvider).toBe(provider);
    expect(day).toBe(1);
    expect(isCurrent).toBe(current);
    return originalPromise;
  });
  try {
    const sequence = prepareGameSetup(
      {
        world() {
          trace.push("world");
          return game.world;
        },
        toolGateway() {
          trace.push("gateway");
          return gateway;
        },
        events() {
          trace.push("events");
          return events;
        },
        config() {
          trace.push("config");
          return game.boardConfig;
        },
      },
      provider,
      1,
      current,
    );
    const step = sequence.next();
    expect(step.done).toBe(false);
    expect(step.value).toBe(originalPromise);
    expect(trace).toEqual(["world", "world", "world", "gateway", "events", "config", "execute"]);
    release(true);
    const ready = await originalPromise;
    queueMicrotask(() => trace.push("queued"));
    expect(sequence.next(ready)).toEqual({ done: true, value: true });
    trace.push("complete");
    expect(trace.slice(-4)).toEqual(["current", "world", "world", "complete"]);
    await Promise.resolve();
    expect(trace.at(-1)).toBe("queued");
  } finally {
    spy.mockRestore();
  }
});
