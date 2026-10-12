/**
 * Unit tests: Radiant Eclipse configuration reads its immutable public example as input;
 * literal roundtrip/bootstrap equality and named Witch-policy rejection check the finite
 * board contract. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/runtime/config/board_definition";
import { configDiagnostic } from "../../../src/runtime/config/error_codes";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { getDefaultNightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import { isRadiantEclipsePreset } from "../../../src/rulesets";
const dir = new URL("../../../../configs.example/boards/", import.meta.url);
const raw = JSON.parse(await readFile(new URL("awa_radiant_eclipse_12_v1.json", dir), "utf8"));
test("public example actually parses, roundtrips and bootstraps the exact sourced board", () => {
  const parsed = parseBoardDefinition(raw);
  expect(isRadiantEclipsePreset(parsed.config)).toBe(true);
  expect(parseBoardDefinition(boardDefinitionFromConfig(raw.id, parsed.config)).config).toEqual(
    parsed.config,
  );
  const { world } = bootstrapGame(parsed.config);
  expect(world.entityIds()).toHaveLength(12);
  const stages = getDefaultNightStageRegistry()
    .getStages(parsed.config, world)
    .map((s) => [s.id, s.priority]);
  expect(
    stages.filter(([id]) =>
      ["reset_night_role_state", "eclipse_swallow", "radiant_shelter", "dreamer_action"].includes(
        String(id),
      ),
    ),
  ).toEqual([
    ["reset_night_role_state", 100],
    ["eclipse_swallow", 110],
    ["radiant_shelter", 120],
    ["dreamer_action", 150],
  ]);
});
test("valid but incompatible Witch policy preserves named finite board error at public diagnostic", () => {
  const bad = structuredClone(raw);
  bad.roles.witch.selfHeal = "always";
  let caught: unknown;
  try {
    parseBoardDefinition(bad);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toBe("board_config_radiant_eclipse_preset_invalid: board");
  expect(configDiagnostic(caught)).toEqual({
    code: "board_config_radiant_eclipse_preset_invalid",
    path: "board",
  });
});
test("the same internal incompatible Witch policy is rejected by direct bootstrap", () => {
  const config = parseBoardDefinition(raw).config;
  config.witch!.canSelfHeal = "always" as never;
  expect(() => bootstrapGame(config)).toThrow("radiant_eclipse_preset_invalid");
});
test("both role policy inputs are strict; a typo cannot be overwritten by the other role", () => {
  for (const role of ["radiant_count", "eclipse_maid"]) {
    const bad = structuredClone(raw);
    bad.roles[role].policy = "typo";
    expect(() => parseBoardDefinition(bad)).toThrow(
      "board_config_invalid_field: roles." + role + ".policy",
    );
  }
});
