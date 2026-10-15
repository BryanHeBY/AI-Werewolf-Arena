/**
 * 单元测试以固定公开板子、原生选择及抛错 World／event getter 为输入，核对 Mist／Raven 开窗发表及晚清理转交。字面轨迹、原错误对象及 frame 可用性为独立预期；不运行整局、pending damage 驱动或传输。业务交接不得在 summary 准备成功前转移清理权。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { Role } from "@ai-werewolf-arena/game-contract";
import rawBoard from "../../../../../configs.example/boards/awa_mist_raven_12_v1.json";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/domain";
import {
  MistNightUnit,
  mistNightTerminal,
} from "../../../../src/features/mist-raven/night-lifecycle";
import {
  beginMistNight,
  commitMistChoice,
  openSnakeWindow,
  snakeWindowTargets,
  commitSnakeChoice,
  ravenAwakened,
  ravenKnownTeammates,
} from "../../../../src/features/mist-raven/night-frame";

function fixture() {
  const board = parseBoardDefinition(rawBoard),
    game = bootstrapGame(board.config, {
      fixedRoles: board.config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    events: GameEvent[] = [],
    trace: string[] = [];
  const runtime = {
    get world() {
      trace.push("world");
      return game.world;
    },
    get events() {
      trace.push("events");
      return events;
    },
  };
  return { ...game, events, trace, runtime, unit: new MistNightUnit(runtime, 1) };
}

test("business damage handoff keeps cleanup owned until the later transfer", () => {
  const f = fixture();
  expect(f.trace).toEqual([]);
  f.unit.open();
  commitMistChoice(f.world, 1, null);
  const target = {
    get id() {
      f.trace.push("target");
      return null;
    },
  };
  expect(f.unit.captureDamage(f.runtime.world, 1, target.id)).toEqual({
    delayEligible: true,
    extra: null,
  });
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world", "world", "target", "world"]);
  expect(() => mistNightTerminal.closeNormally(f.world, 1)).toThrow("mist_night_unavailable");
});

test("late transfer suppresses pipeline abort but normal manager close retains repeated cleanup", () => {
  const f = fixture();
  f.unit.open();
  commitMistChoice(f.world, 1, null);
  f.unit.captureDamage(f.runtime.world, 1, null);
  const alchemistId = f.world.getEntityIdsByRole(Role.Alchemist)[0]!;
  openSnakeWindow(f.world, 1, [], () => true);
  expect(snakeWindowTargets(f.world, 1, alchemistId)).toEqual([]);
  commitSnakeChoice(f.world, 1, alchemistId, null);
  f.unit.transferToManager(true);
  f.unit.abortIfOwned();
  mistNightTerminal.closeNormally(f.runtime.world, 1);
  mistNightTerminal.abort(f.runtime.world);
  mistNightTerminal.abort(f.runtime.world);
  expect(f.trace).toEqual(["world", "world", "world", "world", "world"]);
  expect(() => mistNightTerminal.closeNormally(f.world, 1)).toThrow("mist_night_unavailable");
});

test("partially failed native begin still reads cleanup World and retains its started prefix", () => {
  const f = fixture(),
    error = new Error("mist_lives_capture_rejected"),
    original = f.world.getAliveEntityIds;
  f.world.getAliveEntityIds = () => {
    throw error;
  };
  expect(() => f.unit.open()).toThrow(error);
  f.world.getAliveEntityIds = original;
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world", "world"]);
  expect(f.events).toEqual([]);
  expect(() => beginMistNight(f.world, 1)).toThrow("mist_night_reentry");
});

test("failed unseal publication retains Raven knowledge and configured abort without acquisition gating", () => {
  const f = fixture();
  for (const id of f.world.getEntityIdsByRole(Role.Wolf).slice(0, 2))
    f.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  Object.seal(f.events);
  expect(() => f.unit.open()).toThrow(TypeError);
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world", "events", "world"]);
  expect(f.events).toEqual([]);
  expect(ravenAwakened(f.world)).toBe(true);
  expect(ravenKnownTeammates(f.world)).toEqual([3]);
  expect(() => beginMistNight(f.world, 1)).toThrow("mist_night_reentry");
});
