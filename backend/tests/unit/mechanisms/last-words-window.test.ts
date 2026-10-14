/**
 * 单元测试验证完整遗言窗口的惰性构造、原生命撤销及发表／关闭失败顺序。
 * 输入为真实 bootstrap World、请求工厂、网关和死亡许可；受控回复与独立错误对象是字面预期。
 * 不运行整局或模型，不以请求 context 或测试关闭适配器替代 World 内保存的许可。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { DeathCause, Phase, Role, type ActionRequest, type GameEvent, type RuntimeSnapshot, type ToolCall } from "../../../src/core/domain/model";
import { World } from "../../../src/core/domain/world";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { getDefaultLastWordsMechanism } from "../../../src/game/mechanisms/last_words/last_words_mechanism";
import { LastWordsWindow } from "../../../src/game/mechanisms/last_words/window";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

function fixture() {
  const game = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
  });
  const events: GameEvent[] = [];
  const state: RuntimeSnapshot = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  const originalLife = game.world.getComponent(5, COMPONENT.Alive)!;
  originalLife.alive = false;
  return { world: game.world, events, state, originalLife, toolGateway: new ToolGateway() };
}

test("last words construct at collection entry and reject a delayed reply after replacing the original life", async () => {
  const f = fixture(), trace: string[] = [];
  const state: RuntimeSnapshot = {
    get day() { trace.push("day"); return 1; },
    phase: Phase.Day,
    gameOver: false,
    result: null,
  };
  class TrackingRequests extends GameActionRequestFactory {
    constructor(world: World, events: readonly GameEvent[], day: number) {
      trace.push("construct");
      expect(world).toBe(f.world);
      expect(events).toBe(f.events);
      expect(day).toBe(1);
      super(world, events, day);
    }
  }
  const window = new LastWordsWindow({
    get requestFactory() { trace.push("factory"); return TrackingRequests; },
    get world() { trace.push("world"); return f.world; },
    get events() { trace.push("events"); return f.events; },
    get state() { return state; },
    toolGateway: f.toolGateway,
    lastWordsMechanism: getDefaultLastWordsMechanism(),
  });
  expect(trace).toEqual([]);
  let notify!: () => void, reply!: (call: ToolCall | null) => void;
  const requested = new Promise<void>((resolve) => { notify = resolve; });
  const response = new Promise<ToolCall | null>((resolve) => { reply = resolve; });
  let captured: ActionRequest | undefined;
  const collecting = window.collect([5], Phase.Day, Phase.Night, { 5: [DeathCause.WolfKill] }, {
    getAction(request) { captured = request; notify(); return response; },
  }, {});
  await requested;
  expect(trace.slice(0, 6)).toEqual(["factory", "world", "events", "day", "construct", "day"]);
  expect(captured?.context.stage).toBe("last_words");
  expect(captured?.context.day).toBe(1);
  expect(captured?.allowedTools).toEqual(["speak"]);
  expect(f.world.activeDeathActionCount).toBe(1);
  // 相同席位与死亡值不是原生命；替换为另一真实工厂生命后，旧请求不得发表。
  const replacementLife = createAliveComponent(false);
  f.world.addComponent(5, COMPONENT.Alive, replacementLife);
  reply({ name: "speak", args: { text: "literal-delayed-words" } });
  await collecting;
  expect(f.world.getComponent(5, COMPONENT.Alive)).toBe(replacementLife);
  expect(f.originalLife.alive).toBe(false);
  expect(f.events).toEqual([]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("last words preserve the publication prefix and finally close error priority", async () => {
  const f = fixture(), trace: string[] = [];
  const publicationFailure = new Error("literal_last_words_publication_failure");
  const closeFailure = new Error("literal_last_words_close_failure");
  const open = f.world.openDeathAction;
  let permitId: number | undefined;
  f.world.openDeathAction = function(...args: Parameters<World["openDeathAction"]>) {
    trace.push("open");
    const permit = open.apply(this, args);
    permitId = permit.id;
    // 实际许可仍保存在 World；只适配收尾，以观察原 finally 的错误覆盖顺序。
    return {
      id: permit.id,
      close() { trace.push("close"); permit.close(); throw closeFailure; },
    };
  };
  let published: GameEvent | undefined;
  f.events.push = function(...items: GameEvent[]) {
    trace.push("publish");
    published = items[0];
    throw publicationFailure;
  };
  const window = new LastWordsWindow({
    requestFactory: GameActionRequestFactory,
    world: f.world,
    events: f.events,
    state: f.state,
    toolGateway: f.toolGateway,
    lastWordsMechanism: getDefaultLastWordsMechanism(),
  });
  await expect(window.collect([5], Phase.Day, Phase.Night, { 5: [DeathCause.WolfKill] }, {
    async getAction(request) {
      trace.push("provider");
      expect(f.world.hasDeathAction(5, "speak", Phase.Day, 1, permitId)).toBe(true);
      expect(request.context.death_action_id).toBe(permitId);
      return { name: "speak" as const, args: { text: " literal-spoken-prefix " } };
    },
  }, {})).rejects.toBe(closeFailure);
  expect(trace).toEqual(["open", "provider", "publish", "close"]);
  expect(published?.type).toBe("last_words_spoken");
  if (published?.type !== "last_words_spoken") throw new Error("literal_missing_words_event");
  expect(published.payload).toEqual({ playerId: 5, phase: Phase.Day, day: 1, text: "literal-spoken-prefix" });
  expect(f.events).toHaveLength(0);
  expect(f.world.activeDeathActionCount).toBe(0);
  expect(f.originalLife.alive).toBe(false);
});
