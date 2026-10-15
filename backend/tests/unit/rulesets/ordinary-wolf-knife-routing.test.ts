/**
 * 单元测试负责验证完整狼刀路由的晚读取、原随机调用和已写失败前缀。
 * 输入为实际组件／公开迷雾板子与受控故障；预期顺序、刀口和印记为手写字面，不从生产算法生成。
 * 不执行模型或整局；实际库存仍由原机制安装和支付，测试端口不授予新的角色行动资格。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { World } from "../../../src/domain/world";
import { Role, StatusMark } from "../../../src/domain/model";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../src/domain/components/alive";
import { StatusMarksComponent } from "../../../src/domain/components/status-marks";
import type { WolfKnifeTargetScope } from "../../../src/engine/night/contracts";
import type { TrustedNightStageRuntime as NightStageContext } from "../../../src/engine/night/trusted-runtime";
import { beginMistNight, commitMistChoice } from "../../../src/features/mist-raven/night-frame";
import { readAlchemistState } from "../../../src/features/mist-raven/state";
import { nightStageContext } from "../../support/builders/night-stage-context";
import {
  resolveOrdinaryWolfKnife,
  type AcceptedWolfKnifeTarget,
} from "../../../src/rulesets/ordinary-wolf-knife-routing";

function ordinary() {
  const world = new World(),
    targetId = world.createEntity(),
    life = createAliveComponent();
  world.addComponent(targetId, COMPONENT.Alive, life);
  const ctx = nightStageContext({ world, pickMajorityTarget: () => targetId });
  ctx.state.wolfVotes = { [targetId]: 1 };
  const accepted: AcceptedWolfKnifeTarget[] = [
    { actorId: 8, targetId, life, version: aliveLifeVersion(life)! },
  ];
  return { ctx, world, targetId, life, accepted };
}

test("mist draw publication failure preserves paid mist and reads RNG twice before any knife write", async () => {
  const raw = JSON.parse(
    await readFile(
      new URL("../../../../configs.example/boards/awa_mist_raven_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  const game = bootstrapGame(parseBoardDefinition(raw).config, {
    fixedRoles: [
      Role.Alchemist,
      Role.Seer,
      Role.Dreamer,
      Role.Idiot,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.RavenClawWolf,
      Role.Wolf,
      Role.Wolf,
      Role.Wolf,
    ],
  });
  beginMistNight(game.world, 1);
  commitMistChoice(game.world, 1, [10, 11, 12]);
  const trace: string[] = [],
    failure = new Error("draw_publication_failure");
  const ctx = nightStageContext({ world: game.world, pickMajorityTarget: () => null });
  const state = ctx.state,
    votes = state.wolfVotes,
    events = ctx.events;
  Object.defineProperty(state, "wolfVotes", {
    get() {
      trace.push("votes:get");
      return votes;
    },
  });
  Object.defineProperty(ctx, "pickMajorityTarget", {
    get() {
      trace.push("majority:get");
      return function (this: NightStageContext, input: Record<number, number>) {
        trace.push("majority:call");
        expect(this).toBe(ctx);
        expect(input).toBe(votes);
        return null;
      };
    },
  });
  Object.defineProperty(ctx, "world", {
    get() {
      trace.push("world:get");
      return game.world;
    },
  });
  Object.defineProperty(ctx, "pickMistKnife", {
    get() {
      trace.push("rng:get");
      return function (this: NightStageContext, circle: readonly number[]) {
        trace.push("rng:call");
        expect(this).toBe(ctx);
        expect(circle).toEqual([10, 11, 12]);
        return 11;
      };
    },
  });
  ctx.currentDay = () => {
    trace.push("day:call");
    return 1;
  };
  Object.defineProperty(ctx, "events", {
    get() {
      trace.push("events:get");
      return events;
    },
  });
  Object.defineProperty(events, "push", {
    value() {
      trace.push("draw:push");
      throw failure;
    },
  });
  let thrown: unknown;
  try {
    resolveOrdinaryWolfKnife(ctx, [], [10, 11, 12], new Set([10, 11, 12]));
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBe(failure);
  expect(trace).toEqual([
    "majority:get",
    "votes:get",
    "majority:call",
    "world:get",
    "world:get",
    "rng:get",
    "rng:get",
    "rng:call",
    "world:get",
    "day:call",
    "events:get",
    "world:get",
    "day:call",
    "draw:push",
  ]);
  expect(state.wolfTarget).toBeNull();
  expect(state.wolfTargetVoters).toBeUndefined();
  expect(state.wolfTargetScope).toBeUndefined();
  // 已支付的雾圈不因后续事件失败退回库存；读的是本族原状态，不伪造一个可提交的镜像。
  const role = game.world.getComponent(1, COMPONENT.Role)!;
  expect(
    readAlchemistState((role.privateState as { alchemist?: unknown }).alchemist)?.mistRemaining,
  ).toBe(0);
});

test("modifier failure keeps selected knife but precedes voter and mapping writes", () => {
  const { ctx, targetId, accepted } = ordinary(),
    trace: string[] = [];
  const failure = new Error("modifier_failure"),
    previousVoters = [99];
  ctx.state.wolfTargetVoters = previousVoters;
  const effects = {
    ...ctx.nativeNightEffects,
    recordKnifeModifierTarget(target: () => number | null) {
      trace.push("effect:call");
      expect(this).toBe(effects);
      expect(target()).toBe(1);
      throw failure;
    },
  };
  Object.defineProperty(ctx, "nativeNightEffects", {
    get() {
      trace.push("effect:get");
      return effects;
    },
  });
  Object.defineProperty(ctx, "nativeNightTargets", {
    get() {
      throw new Error("unexpected_mapping_read");
    },
  });
  let thrown: unknown;
  try {
    resolveOrdinaryWolfKnife(ctx, accepted, [8], new Set());
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBe(failure);
  expect(trace).toEqual(["effect:get", "effect:call"]);
  expect(ctx.state.wolfTarget).toBe(targetId);
  expect(ctx.state.wolfTargetVoters).toBe(previousVoters);
  expect(ctx.state.wolfTargetScope).toBeUndefined();
});

test("scope setter failure follows current mapping and real mark without refund", () => {
  const { ctx, world, accepted } = ordinary(),
    trace: string[] = [],
    state = ctx.state;
  const mappedId = world.createEntity(),
    mappedLife = createAliveComponent(),
    marks = new StatusMarksComponent();
  world.addComponent(mappedId, COMPONENT.Alive, mappedLife);
  const failure = new Error("scope_setter_failure"),
    add = marks.add;
  let marked = false,
    attempted: WolfKnifeTargetScope | undefined;
  Object.defineProperty(marks, "add", {
    value(this: StatusMarksComponent, mark: StatusMark) {
      trace.push("mark:add");
      add.call(this, mark);
      marked = true;
    },
  });
  const effects = {
    ...ctx.nativeNightEffects,
    recordKnifeModifierTarget() {
      trace.push("effect");
    },
  };
  Object.defineProperty(ctx, "nativeNightEffects", { value: effects });
  const mapping = {
    requestedId: 1,
    effectiveId: 2,
    get scope() {
      trace.push("mapping:scope");
      return { id: mappedId, life: mappedLife, version: 0 };
    },
    isCurrent() {
      trace.push("mapping:current");
      expect(this).toBe(mapping);
      return true;
    },
  };
  const targets = {
    ...ctx.nativeNightTargets,
    mappedTarget(day: () => number, target: () => number) {
      trace.push("mapping:call");
      expect(this).toBe(targets);
      trace.push(`day:${day()}`, `target:${target()}`);
      return mapping;
    },
  };
  Object.defineProperty(ctx, "nativeNightTargets", {
    get() {
      trace.push("mapping:get");
      return targets;
    },
  });
  ctx.ensureMarks = function (id) {
    trace.push(`ensure:${id}`);
    expect(this).toBe(ctx);
    return marks;
  };
  Object.defineProperty(ctx, "state", {
    get() {
      if (marked) trace.push("state:lvalue");
      return state;
    },
  });
  Object.defineProperty(state, "wolfTargetScope", {
    set(value: WolfKnifeTargetScope) {
      trace.push("scope:set");
      attempted = value;
      throw failure;
    },
  });
  let thrown: unknown;
  try {
    resolveOrdinaryWolfKnife(ctx, accepted, [8], new Set());
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBe(failure);
  expect(trace).toEqual([
    "effect",
    "mapping:get",
    "mapping:call",
    "day:1",
    "target:1",
    "mapping:current",
    "ensure:2",
    "mark:add",
    "state:lvalue",
    "mapping:scope",
    "mapping:scope",
    "scope:set",
  ]);
  expect(marks.has(StatusMark.WolfKillMark)).toBe(true);
  expect(state.wolfTarget).toBe(1);
  expect(state.wolfTargetVoters).toEqual([8]);
  expect(attempted?.targetId).toBe(2);
  expect(attempted?.life).toBe(mappedLife);
  expect(attempted?.marks).toBe(marks);
});
