/**
 * 单元测试负责规则集请求绑定的原顺序、短路及已注册前缀。输入为实际工厂、字面阶段 getter 和真实墙窗口；
 * 输出用手写读取 trace、原请求／context 引用及机制查询核对，不生成规则预期或执行整局／模型。
 * 数据副本不得继承绑定，期限别名仍由原机制登记；后续阶段读取失败不清洗此前成功绑定或消费墙库存。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, type ActionStage } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { deriveBoundedRequest } from "../../../src/core/domain/request_delivery";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { bindRulesetActionRequest } from "../../../src/rulesets/action-request-bindings";
import { initialIdentityRequestScope } from "../../../src/game/mechanisms/roles/initial_identity/setup";
import { lonelyGirlRequestScope } from "../../../src/game/mechanisms/roles/lonely_girl/lifecycle";
import { wildChildRequestScope } from "../../../src/game/mechanisms/roles/wild_child/lifecycle";
import { ghostBrideRequestScope } from "../../../src/game/mechanisms/roles/ghost_bride/authority";
import {
  openWall,
  grantWallNote,
  closeWall,
  wallRequestScope,
} from "../../../src/game/mechanisms/events/wall_notes/authority";

type FactoryInput = Parameters<GameActionRequestFactory["create"]>[0];

function wallFixture() {
  const world = new World(),
    actor = world.createEntity();
  world.addComponent(actor, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  world.addComponent(actor, COMPONENT.Alive, createAliveComponent());
  const wall = openWall(world, () => true),
    author = grantWallNote(world, wall, actor)!;
  const input: FactoryInput = {
    actorId: actor,
    phase: Phase.Voting,
    stage: "wall_notes",
    allowedTools: ["write_note"],
    requiresAction: true,
    summary: "literal wall request",
    context: { wall_id: wall.token, item_instance_id: author.instanceId },
  };
  return { world, wall, author, input, factory: new GameActionRequestFactory(world, [], 1) };
}

test("actual factory rereads input stages in the original five-branch order and short-circuits thief", () => {
  const world = new World(),
    factory = new GameActionRequestFactory(world, [], 1),
    trace: string[] = [],
    stages: ActionStage[] = [
      "day_speech",
      "lonely_girl",
      "wild_child",
      "thief",
      "wall_notes",
      "ghost_bride_groom",
    ];
  let reads = 0;
  Object.defineProperty(factory, "world", {
    get() {
      trace.push("world");
      return world;
    },
  });
  const input: FactoryInput = {
    actorId: 1,
    phase: Phase.Night,
    get stage() {
      trace.push(`stage:${reads}`);
      return stages[reads++]!;
    },
    allowedTools: ["speak"],
    requiresAction: false,
    summary: "literal sequence",
  };
  const request = factory.create(input);
  expect(trace).toEqual([
    "stage:0",
    "world",
    "stage:1",
    "world",
    "stage:2",
    "world",
    "stage:3",
    "world",
    "stage:4",
    "world",
    "stage:5",
    "world",
  ]);
  expect(request.context.stage).toBe("day_speech");
  expect(request.allowedTools).not.toBe(input.allowedTools);
  expect([
    lonelyGirlRequestScope(world, request),
    wildChildRequestScope(world, request),
    initialIdentityRequestScope(world, request),
    wallRequestScope(world, request),
    ghostBrideRequestScope(world, request),
  ]).toEqual([undefined, undefined, undefined, undefined, undefined]);
});

test("actual wall binding preserves original request context and its mechanism-owned deadline alias", () => {
  const { world, wall, author, input, factory } = wallFixture();
  try {
    const request = factory.create(input),
      context = request.context,
      alias = deriveBoundedRequest(request, 12345);
    expect(wallRequestScope(world, request)).toBe(wall);
    expect(context).not.toBe(input.context);
    expect(alias.context).toBe(context);
    // 原 12345 输入保留；F02 只拒过去期限 alias，原请求和作者库存仍有效。
    expect(wallRequestScope(world, alias)).toBeUndefined();
    expect(wallRequestScope(world, structuredClone(request))).toBeUndefined();
    expect(author.note.remaining).toBe(1);
  } finally {
    closeWall(world, wall);
  }
});

test("a later stage getter failure keeps the earlier real wall binding until its owner closes", () => {
  const { world, wall, author, input, factory } = wallFixture(),
    failure = new Error("literal_stage_after_wall_failure"),
    trace: string[] = [];
  let factoryReads = 0,
    bindingReads = 0;
  try {
    // 请求快照保持 wall_notes；当次工厂分支读取其它阶段，所以先得到未绑定的真实请求。
    const request = factory.create({
      ...input,
      get stage(): ActionStage {
        return factoryReads++ === 0 ? "wall_notes" : "day_speech";
      },
    });
    expect(wallRequestScope(world, request)).toBeUndefined();
    expect(() =>
      bindRulesetActionRequest(request, {
        stage() {
          trace.push(`stage:${bindingReads}`);
          if (bindingReads === 5) throw failure;
          return bindingReads++ === 4 ? "wall_notes" : "day_speech";
        },
        world() {
          trace.push("world");
          return world;
        },
      }),
    ).toThrow(failure);
    expect(trace).toEqual([
      "stage:0",
      "stage:1",
      "stage:2",
      "stage:3",
      "stage:4",
      "world",
      "stage:5",
    ]);
    expect(wallRequestScope(world, request)).toBe(wall);
    expect(author.note.remaining).toBe(1);
    closeWall(world, wall);
    expect(wallRequestScope(world, request)).toBeUndefined();
  } finally {
    closeWall(world, wall);
  }
});
