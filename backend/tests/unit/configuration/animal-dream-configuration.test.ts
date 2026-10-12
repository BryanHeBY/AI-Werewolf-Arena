/**
 * Unit tests: Animal configuration reads immutable public examples for skip/ballot
 * policies; exact reverse-config and installed-state assertions check the declared finite
 * board contract. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/runtime/config/load_board_definition";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { configDiagnostic } from "../../../src/runtime/config/error_codes";
import { bootstrapGame } from "../../../src/app/bootstrap";
for (const skip of ["wait", "skip"])
  for (const ballot of ["first", "final"])
    test(`Animal public example strict roundtrip ${skip}/${ballot}`, async () => {
      const id = `twelve_player_animal_dream_${skip}_${ballot}`,
        board = await loadBoardDefinition(
          path.resolve(import.meta.dir, "../../../../configs.example"),
          id,
        ),
        again = parseBoardDefinition(boardDefinitionFromConfig(id, board.config));
      expect(again.config).toEqual(board.config);
      expect(bootstrapGame(board.config).world.getAliveEntityIds()).toHaveLength(12);
      expect(board.config.whiteCat!.skippedVotePolicy).toBe(
        skip === "wait" ? "awa_wait_for_actual_exile_v1" : "awa_expire_on_skipped_day_v1",
      );
      expect(board.config.pufferfish!.ballotPolicy).toBe(
        ballot === "first" ? "awa_first_ballot_v1" : "awa_final_ballot_v1",
      );
      for (const role of ["white_cat", "fox_cub", "pufferfish", "bear"]) {
        const changed = structuredClone(board.definition);
        changed.roles[role] = {
          ...(changed.roles[role] as Record<string, unknown>),
          imagined: true,
        };
        expect(() => parseBoardDefinition(changed)).toThrow("board_config_invalid_field");
      }
      const invalid = { ...board.config, bear: { signalPolicy: "awa_night_open_v1" as const } };
      expect(() => bootstrapGame(invalid)).toThrow("animal_dream_preset_invalid");
      try {
        parseBoardDefinition(boardDefinitionFromConfig(id, invalid));
        throw Error("expected_rejection");
      } catch (e) {
        expect(configDiagnostic(e).code).toBe("board_config_animal_dream_preset_invalid");
      }
    });
