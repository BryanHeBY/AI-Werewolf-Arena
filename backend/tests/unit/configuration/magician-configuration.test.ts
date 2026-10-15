/**
 * 单元测试读取不可变魔术师公开示例，用精确首夜／枪政策往返和 bootstrap 字段核对有限装配契约。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { isMagicianPreset } from "../../../src/rulesets";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { magicianTwelveConfig } from "../../../src/rulesets/presets/magician-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
import { boardConfigSchema } from "../../../src/domain/board-schema";
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
