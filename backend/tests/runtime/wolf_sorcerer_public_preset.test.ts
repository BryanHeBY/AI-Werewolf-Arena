import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../src/runtime/config/board_definition";
import { wolfSorcererTwelveConfig } from "../../src/runtime/scenarios/wolf_sorcerer_twelve";
test("Public Wolf Sorcerer preset matches the validated twelve-player scenario", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../../configs.example/boards/awa_wolf_sorcerer_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  expect(parseBoardDefinition(raw)).toEqual(
    parseBoardDefinition(
      boardDefinitionFromConfig("awa_wolf_sorcerer_12_v1", wolfSorcererTwelveConfig),
    ),
  );
});
