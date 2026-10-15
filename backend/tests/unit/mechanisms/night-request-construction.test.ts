/**
 * 单元测试验证四个夜间控制器的惰性构造点和原失败前缀。输入真实有限猎魔人／婚礼绑定与字面构造故障，
 * 预期以原请求绑定、回合可重开、库存引用及明确读取轨迹给出；不把构造依赖或上下文当行动许可。
 * 猎魔／婚礼 try 内关闭，原生药／夜行动 try 外失败不补清理；只观察原 owner，不运行整局或模型。
 */
import { expect, test } from "bun:test";
import { Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../src/domain/components/names";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { demonHunterFixture } from "../../support/features/demon-hunter/builders/candidate-world";
import {
  ghostBrideBoard,
  ghostBrideDeck,
} from "../../support/features/ghost-bride/builders/scenario";
import { nightStageContext } from "../../support/builders/night-stage-context";
import { executeDemonHunterTurn } from "../../../src/features/demon-hunter/controller";
import { executeDemonWitchTurn } from "../../../src/features/demon-hunter/native-potion-controller";
import { executeDemonNativeNight } from "../../../src/features/demon-hunter/native-night-controller";
import {
  beginDemonHunterNight,
  closeDemonHunterNight,
  bindDemonHunterRequest,
  demonHunterRequestScope,
  openDemonWitchTurnFrame,
} from "../../../src/features/demon-hunter/authority";
import { executeWeddingTurn } from "../../../src/features/ghost-bride/setup";
import {
  beginWeddingSetup,
  openWeddingTurn,
  closeWeddingTurn,
  closeWeddingSetup,
} from "../../../src/features/ghost-bride/authority";
const noProvider = {
  async getAction(): Promise<never> {
    throw new Error("literal_unexpected_provider");
  },
};

test("猎魔和婚礼构造getter失败仍关闭try内原许可而不补交选择", async () => {
  const game = demonHunterFixture(),
    events: GameEvent[] = [],
    trace: string[] = [],
    failure = new Error("literal_inside_factory_failure");
  const construction = {
    get requestFactory(): never {
      trace.push("factory");
      throw failure;
    },
  };
  beginDemonHunterNight(game.world, 2, () => true);
  try {
    await expect(
      executeDemonHunterTurn({
        world: game.world,
        gateway: game.gateway,
        events,
        provider: noProvider,
        day: 2,
        construction,
      }),
    ).rejects.toBe(failure);
    const request = new GameActionRequestFactory(game.world, events, 2).create({
      phase: Phase.Night,
      actorId: 6,
      allowedTools: ["demon_hunt"],
      stage: "demon_hunter",
      requiresAction: true,
      summary: { key: "request.summary.night_action" },
    });
    // 若原 finally 未关闭 turn，真实绑定会取得该scope；这里不伪造新的许可或成功选择。
    bindDemonHunterRequest(game.world, request);
    expect(demonHunterRequestScope(game.world, request)).toBeUndefined();
    expect(events).toEqual([]);
  } finally {
    closeDemonHunterNight(game.world);
  }
  const wedding = bootstrapGame(ghostBrideBoard(), { fixedRoles: ghostBrideDeck });
  const before = JSON.stringify(wedding.world.getComponent(1, COMPONENT.Role)!.privateState);
  beginWeddingSetup(wedding.world, wedding.boardConfig, () => true);
  try {
    await expect(
      executeWeddingTurn({
        world: wedding.world,
        gateway: new ToolGateway(),
        events,
        provider: noProvider,
        day: 1,
        actorId: 1,
        kind: "bridegroom",
        tool: "choose_bridegroom",
        stage: "ghost_bride_groom",
        isCurrent: () => true,
        construction,
      }),
    ).rejects.toBe(failure);
    // 同一原体能再次开原opaque turn，证明失败只关闭该turn；尚未提交配对或耗尽设置库存。
    const scope = openWeddingTurn(wedding.world, "bridegroom", 1, 1, () => true);
    closeWeddingTurn(scope);
    expect(JSON.stringify(wedding.world.getComponent(1, COMPONENT.Role)!.privateState)).toBe(
      before,
    );
    expect(trace).toEqual(["factory", "factory"]);
    expect(events).toEqual([]);
  } finally {
    closeWeddingSetup(wedding.world, "failed");
  }
});

test("原生药try外构造故障保夜复位前缀且不重新开启原frame", async () => {
  const game = demonHunterFixture(),
    events: GameEvent[] = [],
    failure = new Error("literal_potion_factory_failure");
  const state = game.world.getComponent(game.witchId, COMPONENT.Role)!.privateState,
    before = JSON.stringify(state);
  let reads = 0;
  beginDemonHunterNight(game.world, 1, () => true);
  try {
    await expect(
      executeDemonWitchTurn({
        world: game.world,
        gateway: game.gateway,
        events,
        provider: noProvider,
        day: 1,
        wolfTarget: 3,
        construction: {
          get requestFactory(): never {
            reads++;
            throw failure;
          },
        },
      }),
    ).rejects.toBe(failure);
    expect(reads).toBe(1);
    expect(game.world.getComponent(game.witchId, COMPONENT.Role)!.privateState).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    // 原frame开启已经消费本夜开启位；失败位于原try外，不增加新的清理/退款或允许重开。
    expect(openDemonWitchTurnFrame(game.world)).toBeNull();
    expect(events).toEqual([]);
  } finally {
    closeDemonHunterNight(game.world);
  }
});

test("原生夜构造callee先于events参数读取且try外故障不写库存", async () => {
  const game = demonHunterFixture(12),
    trace: string[] = [],
    failure = new Error("literal_native_factory_failure");
  const role = game.world.getComponent(11, COMPONENT.Role)!,
    state = role.privateState,
    before = JSON.stringify(state);
  const ctx = nightStageContext({ world: game.world });
  Object.defineProperty(ctx, "requestFactory", {
    get(): never {
      trace.push("factory");
      throw failure;
    },
  });
  Object.defineProperty(ctx, "events", {
    get(): GameEvent[] {
      trace.push("events");
      throw new Error("literal_unexpected_events");
    },
  });
  beginDemonHunterNight(game.world, 1, () => true);
  try {
    await expect(executeDemonNativeNight(ctx, "guard")).rejects.toBe(failure);
    expect(trace).toEqual(["factory"]);
    expect(role.privateState).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  } finally {
    closeDemonHunterNight(game.world);
  }
});
