/**
 * 场景测试验证真实 DeathResolution 的标死→野孩子整波贡献→梦记录→遗言→晚 hook 顺序。
 * 输入为合法固定角色、原榜样选择、旧注入 duck HookRegistry 和字面狼刀；预期为手写状态／事件前缀。
 * 旧 registry 不提供新增整波方法，仍必须执行内建榜样转换；无完整游戏、模型或物理传输。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { Role, Camp, Phase, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../../src/domain/components/names";
import { WildChildSetupWindow } from "../../../../src/features/wild-child/setup";
import { getWildChildState } from "../../../../src/features/wild-child/state-slot";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import type { HookRegistry } from "../../../../src/engine/hooks/registry";
import { DreamNightFrame } from "../../../../src/features/dreamer/night-frame";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";

test("mandatory committed-wave contributions survive a legacy custom hook registry before dream and last words", async () => {
  const roles = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter],
    { world, boardConfig: config } = bootstrapGame(foxBoard(roles), { fixedRoles: roles }),
    events: GameEvent[] = [],
    trace: string[] = [],
    gateway = new ToolGateway();
  expect(
    await new WildChildSetupWindow(world, gateway, events, {
      get requestFactory() {
        return GameActionRequestFactory;
      },
    }).execute(
      config,
      {
        async getAction() {
          return { name: "choose_wild_model", args: { target_id: 2 } };
        },
      },
      1,
      () => true,
    ),
  ).toBe(true);
  const legacyHooks = {
    onVotedOut() {
      return null;
    },
    async onDeath() {
      trace.push("late-hook");
      return { extraDeaths: [], extraDeathSources: {} };
    },
  } as unknown as HookRegistry;
  const resolver = new DeathResolution(
    world,
    events,
    gateway,
    new EventRegistry(legacyHooks),
    {
      day: 1,
      phase: Phase.Day,
      gameOver: false,
      result: null,
    },
    config,
  );
  const dreams = new DreamNightFrame([]);
  dreams.recordDeaths = () => {
    trace.push("dream");
    expect(world.getComponent(2, COMPONENT.Alive)?.alive).toBe(false);
    expect(world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Wolf);
    expect(events.some((event) => event.type === "wild_child_transformed")).toBe(true);
  };
  await resolver.resolve(
    [2],
    { 2: [DeathCause.WolfKill] },
    {
      async getAction() {
        trace.push("last-words");
        expect(getWildChildState(world.getComponent(1, COMPONENT.Role)!)?.status).toBe(
          "transformed",
        );
        return { name: "speak", args: { text: "literal last words" } };
      },
    },
    Phase.Night,
    Phase.Day,
    {},
    {
      dreams,
    },
  );
  expect(trace).toEqual(["dream", "last-words", "late-hook"]);
  const types = events.map((event) => event.type);
  expect(types).toContain("wild_child_model_eliminated");
  expect(types).toContain("last_words_granted");
  expect(types.indexOf("wild_child_model_eliminated")).toBeLessThan(
    types.indexOf("wild_child_transformed"),
  );
  expect(types.indexOf("wild_child_transformed")).toBeLessThan(types.indexOf("last_words_granted"));
});
