/**
 * Unit tests: Trickster eligibility uses the immutable public example; literal predicate
 * and normalized-board equality check the declared twelve-player setup. Inputs and
 * expected outcomes remain the original literal or immutable-fixture oracle; these module
 * assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/runtime/config/board_definition";
import { tricksterTwelveConfig } from "../../../src/runtime/scenarios/trickster_twelve";
test("Public Trickster preset matches the validated twelve-player scenario", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../../../configs.example/boards/awa_trickster_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  expect(parseBoardDefinition(raw)).toEqual(
    parseBoardDefinition(boardDefinitionFromConfig("awa_trickster_12_v1", tricksterTwelveConfig)),
  );
});
