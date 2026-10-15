/**
 * Unit tests check Wolf Sorcerer's borrowed shared cleanup ownership and terminals.
 * A fixed N2 public paired board, native pass and delegated World failures supply
 * inputs; literal getter counts and original unsettled errors are the oracle.
 * No new source algorithm supplies expected output, and no complete night,
 * composed-effect driver, model or recording executes here.
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
  // This unchanged public board activates both casters at N2; N1 has no choice.
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
