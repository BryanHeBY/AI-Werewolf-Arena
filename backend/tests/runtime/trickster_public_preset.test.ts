import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../src/runtime/config/board_definition";
import { tricksterTwelveConfig } from "../../src/runtime/scenarios/trickster_twelve";
test("Public Trickster preset matches the validated twelve-player scenario", () => {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../../configs.example/boards/awa_trickster_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  expect(parseBoardDefinition(raw)).toEqual(
    parseBoardDefinition(boardDefinitionFromConfig("awa_trickster_12_v1", tricksterTwelveConfig)),
  );
});
