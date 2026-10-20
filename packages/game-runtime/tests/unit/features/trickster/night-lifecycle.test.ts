/**
 * 单元测试以固定公开配对板子、原生选择及委托 World 故障为输入，核对诡术师共享清理门及已完成 Day 放逐窗口。字面映射、getter 轨迹及原生错误为独立预期；finish 不得关闭日间映射或增加外层清理。不运行完整夜、投票循环、模型或录制。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import rawBoard from "../../../../../../configs.example/boards/awa_trickster_12_v1.json";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { MagicianNightUnit } from "../../../../src/features/magician/ports";
import {
  TricksterNightUnit,
  tricksterNightTerminal,
} from "../../../../src/features/trickster/ports";
import {
  beginTricksterNight,
  commitTricksterExchange,
  resolveTricksterExile,
} from "../../../../src/features/trickster/night-frame";

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
    unit: new TricksterNightUnit(runtime, magician.cleanupOwnership),
    failWorld(error: Error) {
      failure = error;
    },
  };
}

test("unfinished stage cleanup uses the shared gate and retains original exile refusal", () => {
  const f = fixture(),
    actorId = beginTricksterNight(f.world, 1)!;
  commitTricksterExchange(f.world, actorId, 1, [5, 6]);
  f.magician.transferToManager(false);
  f.unit.abortIfOwned();
  expect(f.trace).toEqual(["world"]);
  expect(() => resolveTricksterExile(f.world, 1, 5)).toThrow("trickster_exile_unsettled");
});

test("normal finish and original inner abort keep the day mapping open without pipeline cleanup", () => {
  const f = fixture(),
    actorId = beginTricksterNight(f.world, 1)!;
  commitTricksterExchange(f.world, actorId, 1, [5, 6]);
  f.magician.transferToManager(true);
  f.unit.abortIfOwned();
  tricksterNightTerminal.finishNormally(f.runtime.world, 1);
  tricksterNightTerminal.abort(f.runtime.world);
  expect(f.trace).toEqual(["world", "world"]);
  expect(() => tricksterNightTerminal.finishNormally(f.world, 1)).toThrow(
    "trickster_night_unsettled",
  );
  expect(resolveTricksterExile(f.world, 1, 5)).toEqual({
    requestedId: 5,
    effectiveId: 6,
    missed: false,
  });
  expect(() => resolveTricksterExile(f.world, 1, 5)).toThrow("trickster_exile_unsettled");
});

test("finished native no-op still observes manager World failure at the original abort site", () => {
  const f = fixture(),
    actorId = beginTricksterNight(f.world, 1)!,
    error = new Error("trickster_terminal_world_rejected");
  commitTricksterExchange(f.world, actorId, 1, [5, 6]);
  tricksterNightTerminal.finishNormally(f.runtime.world, 1);
  f.failWorld(error);
  expect(() => tricksterNightTerminal.abort(f.runtime.world)).toThrow(error);
  expect(f.trace).toEqual(["world", "world"]);
  expect(resolveTricksterExile(f.world, 1, 5)).toEqual({
    requestedId: 5,
    effectiveId: 6,
    missed: false,
  });
});
