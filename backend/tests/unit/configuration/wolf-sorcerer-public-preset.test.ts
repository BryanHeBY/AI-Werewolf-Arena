/**
 * Unit tests: Wolf Sorcerer eligibility uses the immutable public example; exact
 * predicate, policy and normalized-board assertions check the declared finite
 * twelve-player setup. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
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
      new URL("../../../../configs.example/boards/awa_wolf_sorcerer_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  expect(parseBoardDefinition(raw)).toEqual(
    parseBoardDefinition(
      boardDefinitionFromConfig("awa_wolf_sorcerer_12_v1", wolfSorcererTwelveConfig),
    ),
  );
});
