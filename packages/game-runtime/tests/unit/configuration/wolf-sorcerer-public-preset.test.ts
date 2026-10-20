/**
 * 单元测试以不可变狼术师公开示例为输入，用精确 predicate、政策及归一化板子断言核对声明的有限十二人装配。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/app/config/board-definition";
import { wolfSorcererTwelveConfig } from "../../../src/rulesets/presets/wolf-sorcerer-twelve";
test("Public Wolf Sorcerer preset matches the validated twelve-player scenario", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL(
        "../../../../../configs.example/boards/awa_wolf_sorcerer_12_v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  expect(parseBoardDefinition(raw)).toEqual(
    parseBoardDefinition(
      boardDefinitionFromConfig("awa_wolf_sorcerer_12_v1", wolfSorcererTwelveConfig),
    ),
  );
});
