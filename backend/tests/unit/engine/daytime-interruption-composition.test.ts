/**
 * 单元测试验证白天组合的现场 getter 顺序、失败前缀和最早重入拒绝。输入为独立 World、
 * 手写读取轨迹与辩论 owner 的临时窗口；预期为字面顺序及原实例／错误引用，
 * 不复制窗口算法、生成 golden、运行整局或调用模型。
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/core/domain/world";
import { RoleRegistry } from "../../../src/core/domain/registries/role_registry";
import type { GameEvent } from "../../../src/core/domain/model";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { SelfDestructWindow } from "../../../src/rulesets/self-destruct-window";
import { KnightDuelWindow } from "../../../src/game/engine/knight_duel_window";
import { DayPipeline } from "../../../src/game/engine/phase_pipeline/day_pipeline";
import { DebaterWindow } from "../../../src/game/mechanisms/roles/debater/window";
import {
  closeDebate,
  openDebate,
  type DebateAuthority,
} from "../../../src/game/mechanisms/roles/debater/authority";
import { createDaytimeInterruptionComposition } from "../../../src/rulesets/daytime-interruption-composition";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

test("constructs original windows in W/R/G, W/G, W/G/E order without snapshotting", () => {
  const trace: string[] = [],
    worlds = [new World(), new World(), new World()],
    gateways = [new ToolGateway(), new ToolGateway(), new ToolGateway()],
    registry = new RoleRegistry(),
    events: GameEvent[] = [];
  let worldsRead = 0,
    gatewaysRead = 0;
  const composition = createDaytimeInterruptionComposition({
    world: () => {
      trace.push(`world:${worldsRead + 1}`);
      return worlds[worldsRead++]!;
    },
    roleRegistry: () => (trace.push("registry"), registry),
    toolGateway: () => {
      trace.push(`gateway:${gatewaysRead + 1}`);
      return gateways[gatewaysRead++]!;
    },
    events: () => (trace.push("events"), events),
  });
  expect(trace).toEqual([
    "world:1",
    "registry",
    "gateway:1",
    "world:2",
    "gateway:2",
    "world:3",
    "gateway:3",
    "events",
  ]);
  expect(composition.selfDestruct).toBeInstanceOf(SelfDestructWindow);
  expect(composition.duel).toBeInstanceOf(KnightDuelWindow);
  expect(composition.debate).toBeInstanceOf(DebaterWindow);
  // 只在测试中核对原实例捕获引用；生产消费者仍只能使用窄执行端口。
  const self = composition.selfDestruct as unknown as {
      world: World;
      roleRegistry: RoleRegistry;
      toolGateway: ToolGateway;
    },
    duel = composition.duel as unknown as { world: World; gateway: ToolGateway },
    debate = composition.debate as unknown as {
      world: World;
      gateway: ToolGateway;
      events: GameEvent[];
    };
  expect(self.world).toBe(worlds[0]);
  expect(self.roleRegistry).toBe(registry);
  expect(self.toolGateway).toBe(gateways[0]);
  expect(duel.world).toBe(worlds[1]);
  expect(duel.gateway).toBe(gateways[1]);
  expect(debate.world).toBe(worlds[2]);
  expect(debate.gateway).toBe(gateways[2]);
  expect(debate.events).toBe(events);
});

test("second window gateway failure stops before Debater reads and preserves original error", () => {
  const trace: string[] = [],
    failure = new Error("controlled_second_gateway_failure"),
    world = new World(),
    gateway = new ToolGateway();
  let reads = 0;
  expect(() =>
    createDaytimeInterruptionComposition({
      world: () => (trace.push("world"), world),
      roleRegistry: () => (trace.push("registry"), new RoleRegistry()),
      toolGateway: () => {
        trace.push("gateway");
        if (++reads === 2) throw failure;
        return gateway;
      },
      events: () => (trace.push("events"), []),
    }),
  ).toThrow(failure);
  expect(trace).toEqual(["world", "registry", "gateway", "world", "gateway"]);
});

test("entry reads the late World while original windows retain their construction World", () => {
  const original = new World(),
    replacement = new World(),
    authority: DebateAuthority = {
      id: "controlled-debate",
      day: 1,
      actorId: 1,
      targetId: 2,
      stage: "challenge",
      participants: new Map(),
    },
    trace: string[] = [];
  let currentWorld = original;
  const composition = createDaytimeInterruptionComposition({
    world: () => (trace.push("world"), currentWorld),
    roleRegistry: () => new RoleRegistry(),
    toolGateway: () => new ToolGateway(),
    events: () => [],
  });
  trace.length = 0;
  currentWorld = replacement;
  openDebate(replacement, authority);
  try {
    expect(() => composition.assertEntry()).toThrow("debate_window_reentry");
    expect(trace).toEqual(["world"]);
    const debate = composition.debate as unknown as { world: World };
    expect(debate.world).toBe(original);
  } finally {
    closeDebate(replacement, authority);
  }
  expect(() => composition.assertEntry()).not.toThrow();
  expect(trace).toEqual(["world", "world"]);
});

test("pipeline rejects reentry before reading day or currentness and before provider work", async () => {
  const world = new World(),
    events: GameEvent[] = [],
    trace: string[] = [],
    pipeline = new DayPipeline({
      world,
      events,
      roleRegistry: new RoleRegistry(),
      toolGateway: new ToolGateway(),
    }),
    authority: DebateAuthority = {
      id: "controlled-pipeline-debate",
      day: 1,
      actorId: 1,
      targetId: 2,
      stage: "speech",
      participants: new Map(),
    };
  openDebate(world, authority);
  try {
    await expect(
      pipeline.execute(
        sixPlayerMvpConfig,
        { getAction: async () => (trace.push("provider"), null) },
        {
          get day(): number {
            trace.push("day");
            throw new Error("day_read_too_early");
          },
          get isCurrent(): () => boolean {
            trace.push("isCurrent");
            throw new Error("current_read_too_early");
          },
        },
      ),
    ).rejects.toThrow("debate_window_reentry");
    expect(trace).toEqual([]);
    expect(events).toEqual([]);
  } finally {
    closeDebate(world, authority);
  }
});
