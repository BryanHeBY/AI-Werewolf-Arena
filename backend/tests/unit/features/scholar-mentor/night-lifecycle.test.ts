/**
 * 单元测试以固定公开板子及原生空首夜解析为输入，核对 Scholar／Mentor 清理转移和正常／中止的不同结果。字面 getter 轨迹、原 scope 错误及次夜资格为独立预期；不运行完整游戏或 bonus 行动驱动。stage 持有的开窗特意与管线单元分开。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import rawBoard from "../../../../../configs.example/boards/awa_scholar_mentor_12_v1.json";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  ScholarMentorNightUnit,
  scholarMentorNightTerminal,
} from "../../../../src/features/scholar-mentor/night-lifecycle";
import {
  beginScholarMentorNight,
  settleScholarMentorChoices,
} from "../../../../src/features/scholar-mentor/night-frame";

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
    unit: new ScholarMentorNightUnit(runtime),
    failWorld(error: Error) {
      failure = error;
    },
  };
}

test("configured cleanup requires no acquisition and only late transfer suppresses it", () => {
  const f = fixture();
  expect(f.trace).toEqual([]);
  f.unit.abortIfOwned();
  f.unit.transferToManager(false);
  f.unit.abortIfOwned();
  f.unit.transferToManager(true);
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world", "world"]);
  expect(() => scholarMentorNightTerminal.closeNormally(f.world, 1)).toThrow(
    "scholar_mentor_night_unavailable",
  );
});

test("normal close followed by both aborts leaves the next modifier night eligible", () => {
  const f = fixture();
  expect(beginScholarMentorNight(f.world, 1)).toEqual([]);
  settleScholarMentorChoices(f.world, 1);
  scholarMentorNightTerminal.closeNormally(f.runtime.world, 1);
  scholarMentorNightTerminal.abort(f.runtime.world);
  scholarMentorNightTerminal.abort(f.runtime.world);
  expect(f.trace).toEqual(["world", "world", "world"]);
  expect(() => scholarMentorNightTerminal.closeNormally(f.world, 1)).toThrow(
    "scholar_mentor_night_unavailable",
  );
  expect(beginScholarMentorNight(f.world, 2)).toEqual([4, 12]);
});

test("failed unresolved normal close keeps cleanup and prevents a new night", () => {
  const f = fixture();
  beginScholarMentorNight(f.world, 1);
  expect(() => scholarMentorNightTerminal.closeNormally(f.runtime.world, 1)).toThrow(
    "scholar_mentor_night_unsettled",
  );
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world", "world"]);
  expect(() => beginScholarMentorNight(f.world, 2)).toThrow("scholar_mentor_night_invalid");
});

test("closed frame no-op still evaluates current manager World and preserves a thrown getter", () => {
  const f = fixture(),
    error = new Error("scholar_terminal_world_rejected");
  beginScholarMentorNight(f.world, 1);
  settleScholarMentorChoices(f.world, 1);
  scholarMentorNightTerminal.closeNormally(f.runtime.world, 1);
  f.failWorld(error);
  expect(() => scholarMentorNightTerminal.abort(f.runtime.world)).toThrow(error);
  expect(f.trace).toEqual(["world", "world"]);
});
