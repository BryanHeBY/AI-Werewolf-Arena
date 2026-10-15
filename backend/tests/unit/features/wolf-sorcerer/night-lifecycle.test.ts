/**
 * 单元测试以固定 N2 公开配对板子、原生跳过及委托 World 故障为输入，核对狼术师借用的共享清理权和终态。字面 getter 次数及原未结算错误为预期；不以新来源算法生成预期，也不运行完整夜、组合效果驱动、模型或录制。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import rawBoard from "../../../../../configs.example/boards/awa_wolf_sorcerer_12_v1.json";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { MagicianNightUnit } from "../../../../src/features/magician/ports";
import {
  WolfSorcererNightUnit,
  wolfSorcererNightTerminal,
} from "../../../../src/features/wolf-sorcerer/ports";
import {
  beginWolfSorcererNight,
  commitWolfSorcererExchange,
} from "../../../../src/features/wolf-sorcerer/night-frame";

function fixture() {
  const board = parseBoardDefinition(rawBoard),
    game = bootstrapGame(board.config, {
      fixedRoles: board.config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    trace: string[] = [];
  let failure: Error | undefined;
  const runtime = {
    get world() {
      trace.push("world");
      if (failure) throw failure;
      return game.world;
    },
  };
  const magician = new MagicianNightUnit({ world: game.world });
  return {
    ...game,
    trace,
    runtime,
    magician,
    unit: new WolfSorcererNightUnit(runtime, magician.cleanupOwnership),
    failWorld(error: Error) {
      failure = error;
    },
  };
}

function openEligibleSecondNight(world: ReturnType<typeof fixture>["world"]): number {
  // 该未改变的公开板子在 N2 激活两名施法者，N1 没有选择。
  expect(beginWolfSorcererNight(world, 1)).toBeNull();
  wolfSorcererNightTerminal.closeNormally(world, 1);
  return beginWolfSorcererNight(world, 2)!;
}

test("the shared original Magician value controls cleanup even before Sorcerer stage begins", () => {
  const f = fixture();
  expect(f.trace).toEqual([]);
  f.unit.abortIfOwned();
  f.magician.transferToManager(false);
  f.unit.abortIfOwned();
  f.magician.transferToManager(true);
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world", "world"]);
  expect(() => wolfSorcererNightTerminal.closeNormally(f.world, 1)).toThrow(
    "wolf_sorcerer_night_unsettled",
  );
});

test("normal close cannot suppress inner or outer abort reads or repeated native error", () => {
  const f = fixture(),
    actorId = openEligibleSecondNight(f.world);
  commitWolfSorcererExchange(f.world, actorId, 2, null);
  f.magician.transferToManager(true);
  f.unit.abortIfOwned();
  wolfSorcererNightTerminal.closeNormally(f.runtime.world, 2);
  wolfSorcererNightTerminal.abort(f.runtime.world);
  wolfSorcererNightTerminal.abort(f.runtime.world);
  expect(f.trace).toEqual(["world", "world", "world"]);
  expect(() => wolfSorcererNightTerminal.closeNormally(f.world, 2)).toThrow(
    "wolf_sorcerer_night_unsettled",
  );
});

test("unresolved normal close retains configured cleanup and revokes the pending choice", () => {
  const f = fixture(),
    actorId = openEligibleSecondNight(f.world);
  expect(() => wolfSorcererNightTerminal.closeNormally(f.runtime.world, 2)).toThrow(
    "wolf_sorcerer_night_unsettled",
  );
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world", "world"]);
  expect(() => commitWolfSorcererExchange(f.world, actorId, 2, null)).toThrow(
    "wolf_sorcerer_choice_scope_invalid",
  );
});

test("normal close cannot suppress a later manager World getter failure", () => {
  const f = fixture(),
    actorId = openEligibleSecondNight(f.world);
  commitWolfSorcererExchange(f.world, actorId, 2, null);
  wolfSorcererNightTerminal.closeNormally(f.runtime.world, 2);
  const error = new Error("sorcerer_terminal_world_rejected");
  f.failWorld(error);
  expect(() => wolfSorcererNightTerminal.abort(f.runtime.world)).toThrow(error);
  expect(f.trace).toEqual(["world", "world"]);
});
