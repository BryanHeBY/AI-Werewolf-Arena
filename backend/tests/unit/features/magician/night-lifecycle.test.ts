/**
 * Unit tests check the exchange families' single Magician-configured cleanup gate.
 * Inert Worlds, literal getter traces and native fixed-board Magician choice supply
 * inputs; original error identity, repeat-close refusal and one shared transfer
 * observation are independent expectations. No complete night, model or recording
 * runs here. Compile-only counterexamples check the view grants no write/command.
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import rawBoard from "../../../../../configs.example/boards/awa_magician_12_n1_exchanged_v1.json";
import { parseBoardDefinition } from "../../../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  MagicianNightUnit,
  magicianNightTerminal,
  type MagicianNightCleanupOwnership,
} from "../../../../src/game/mechanisms/roles/magician/ports";
import { WolfSorcererNightUnit } from "../../../../src/game/mechanisms/roles/wolf_sorcerer/ports";
import { TricksterNightUnit } from "../../../../src/game/mechanisms/roles/trickster/ports";
import {
  beginMagicianNight,
  commitMagicianExchange,
} from "../../../../src/game/mechanisms/roles/magician/night_frame";

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
