/**
 * 单元测试以固定公开板子及原生首夜选择为输入，核对 Time Consort 配置清理及原 manager 终态。字面 World getter 轨迹和原未结算错误为独立预期；优先级 50 的开窗留在管线单元之外。不运行整局、效果反射驱动或计费传输。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import rawBoard from "../../../../../../configs.example/boards/awa_time_consort_12_v1.json";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  TimeConsortNightUnit,
  timeConsortNightTerminal,
} from "../../../../src/features/time-wolf-consort/night-lifecycle";
import {
  beginTimeConsortNight,
  commitTimeConsortChoice,
} from "../../../../src/features/time-wolf-consort/night-frame";

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
  return {
    ...game,
    trace,
    runtime,
    unit: new TimeConsortNightUnit(runtime),
    failWorld(error: Error) {
      failure = error;
    },
  };
}

test("configured cleanup reads World even when its opening stage never ran", () => {
  const f = fixture();
  expect(f.trace).toEqual([]);
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world"]);
  expect(() => timeConsortNightTerminal.closeNormally(f.world, 1)).toThrow(
    "time_consort_night_unsettled",
  );
});

test("only the original configured late transfer suppresses pipeline cleanup", () => {
  const f = fixture();
  f.unit.transferToManager(false);
  f.unit.abortIfOwned();
  f.unit.transferToManager(true);
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world"]);
});

test("normal close retains inner and outer abort reads and repeated close rejection", () => {
  const f = fixture(),
    actorId = beginTimeConsortNight(f.world, 1)!;
  commitTimeConsortChoice(f.world, actorId, 1, null);
  f.unit.transferToManager(true);
  f.unit.abortIfOwned();
  timeConsortNightTerminal.closeNormally(f.runtime.world, 1);
  timeConsortNightTerminal.abort(f.runtime.world);
  timeConsortNightTerminal.abort(f.runtime.world);
  expect(f.trace).toEqual(["world", "world", "world"]);
  expect(() => timeConsortNightTerminal.closeNormally(f.world, 1)).toThrow(
    "time_consort_night_unsettled",
  );
  expect(() => beginTimeConsortNight(f.world, 2)).not.toThrow();
});

test("normal closure cannot suppress a subsequent manager World getter failure", () => {
  const f = fixture(),
    actorId = beginTimeConsortNight(f.world, 1)!,
    error = new Error("time_terminal_world_rejected");
  commitTimeConsortChoice(f.world, actorId, 1, null);
  timeConsortNightTerminal.closeNormally(f.runtime.world, 1);
  f.failWorld(error);
  expect(() => timeConsortNightTerminal.abort(f.runtime.world)).toThrow(error);
  expect(f.trace).toEqual(["world", "world"]);
});
