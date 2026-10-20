/**
 * 单元测试以受控 World、字面 getter 轨迹及原生固定板子魔术师选择为输入，核对交换族唯一的魔术师配置清理门。原错误对象、重复关闭拒绝及一次共享转移观察为独立预期；不运行完整夜、模型或录制。仅编译负例核对视图不授予写入／命令能力。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import rawBoard from "../../../../../../configs.example/boards/awa_magician_12_n1_exchanged_v1.json";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  MagicianNightUnit,
  magicianNightTerminal,
  type MagicianNightCleanupOwnership,
} from "../../../../src/features/magician/ports";
import { WolfSorcererNightUnit } from "../../../../src/features/wolf-sorcerer/ports";
import { TricksterNightUnit } from "../../../../src/features/trickster/ports";
import {
  beginMagicianNight,
  commitMagicianExchange,
} from "../../../../src/features/magician/night-frame";

function ownershipIsReadOnly(view: MagicianNightCleanupOwnership) {
  // @ts-expect-error A valid boolean callback still cannot replace the readonly query.
  view.isTransferred = () => true;
  // @ts-expect-error The shared view grants no command to transfer cleanup.
  view.transferToManager(true);
}
void ownershipIsReadOnly;

test("one original late config read transfers cleanup for all three units without World reads", () => {
  const world = new World(),
    trace: string[] = [],
    magician = new MagicianNightUnit({
      get world() {
        trace.push("magician");
        return world;
      },
    }),
    sorcerer = new WolfSorcererNightUnit(
      {
        get world() {
          trace.push("sorcerer");
          return world;
        },
      },
      magician.cleanupOwnership,
    ),
    trickster = new TricksterNightUnit(
      {
        get world() {
          trace.push("trickster");
          return world;
        },
      },
      magician.cleanupOwnership,
    );
  expect(trace).toEqual([]);
  expect(Object.isFrozen(magician.cleanupOwnership)).toBe(true);
  trickster.abortIfOwned();
  sorcerer.abortIfOwned();
  magician.abortIfOwned();
  const policy = {
    get magician() {
      trace.push("config.magician");
      return {};
    },
  };
  magician.transferToManager(policy.magician !== undefined);
  trickster.abortIfOwned();
  sorcerer.abortIfOwned();
  magician.abortIfOwned();
  expect(trace).toEqual(["trickster", "sorcerer", "magician", "config.magician"]);
  expect(magician.cleanupOwnership.isTransferred()).toBe(true);
});

test("configured cleanup before stage opening retains first World failure and stops later owners", () => {
  const world = new World(),
    error = new Error("trickster_cleanup_world_rejected"),
    trace: string[] = [],
    magician = new MagicianNightUnit({
      get world() {
        trace.push("magician");
        return world;
      },
    }),
    sorcerer = new WolfSorcererNightUnit(
      {
        get world() {
          trace.push("sorcerer");
          return world;
        },
      },
      magician.cleanupOwnership,
    ),
    trickster = new TricksterNightUnit(
      {
        get world(): World {
          trace.push("trickster");
          throw error;
        },
      },
      magician.cleanupOwnership,
    );
  expect(() => {
    trickster.abortIfOwned();
    sorcerer.abortIfOwned();
    magician.abortIfOwned();
  }).toThrow(error);
  expect(trace).toEqual(["trickster"]);
  expect(magician.cleanupOwnership.isTransferred()).toBe(false);
});

test("normal Magician close keeps inner and outer abort arguments and repeated native refusal", () => {
  const board = parseBoardDefinition(rawBoard),
    game = bootstrapGame(board.config, {
      fixedRoles: board.config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    trace: string[] = [],
    runtime = {
      get world() {
        trace.push("world");
        return game.world;
      },
    },
    unit = new MagicianNightUnit(runtime),
    actorId = beginMagicianNight(game.world, 1)!;
  commitMagicianExchange(game.world, actorId, 1, null);
  unit.transferToManager(true);
  unit.abortIfOwned();
  magicianNightTerminal.closeNormally(runtime.world, 1);
  magicianNightTerminal.abort(runtime.world);
  magicianNightTerminal.abort(runtime.world);
  expect(trace).toEqual(["world", "world", "world"]);
  expect(() => magicianNightTerminal.closeNormally(game.world, 1)).toThrow(
    "magician_night_unsettled",
  );
});
