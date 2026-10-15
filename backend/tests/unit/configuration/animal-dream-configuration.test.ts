/**
 * 单元测试读取不可变公开示例的 skip／ballot 政策，用精确反向配置和已安装状态断言核对 Animal 声明的有限板子契约。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
import { configDiagnostic } from "../../../src/app/config/error-codes";
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
