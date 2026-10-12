/**
 * Integration/scenario tests for magician configuration configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import { expect, test } from "bun:test";
import { isMagicianPreset } from "../../../src/rulesets";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { magicianTwelveConfig } from "../../../src/runtime/scenarios/magician_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
for (const firstNight of [1, 2] as const)
  for (const shot of ["original", "exchanged"] as const)
    test("Magician public board roundtrip/" + firstNight + "/" + shot, async () => {
      const config = structuredClone(magicianTwelveConfig);
      config.magician!.firstNight = firstNight;
      config.magician!.deathShotTargetPolicy = shot;
      expect(isMagicianPreset(config)).toBe(true);
      expect(boardConfigSchema.parse(config)).toEqual(config);
      expect(bootstrapGame(config).playerIds).toHaveLength(12);
      const id = "awa_magician_12_n" + firstNight + "_" + shot + "_v1";
      const definition = await Bun.file(
        new URL("../../../../configs.example/boards/" + id + ".json", import.meta.url),
      ).json();
      expect(parseBoardDefinition(definition).config).toEqual(config);
      expect(boardDefinitionFromConfig(id, config)).toEqual(definition);
    });
