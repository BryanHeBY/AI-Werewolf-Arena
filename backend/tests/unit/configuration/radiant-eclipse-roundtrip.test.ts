/**
 * 单元测试读取不可变 Radiant／Eclipse 公开示例，用字面往返／bootstrap 相等及具名 Witch 政策拒绝核对有限板子契约。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/app/config/board-definition";
import { configDiagnostic } from "../../../src/app/config/error-codes";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { getDefaultNightStageRegistry } from "../../../src/rulesets/night-stage-plan";
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
