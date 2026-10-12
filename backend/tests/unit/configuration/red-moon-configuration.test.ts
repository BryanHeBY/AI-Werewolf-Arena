/**
 * Unit tests: Red Moon configuration reads immutable public boards and incompatible
 * mutations; exact roundtrip and named rejection assertions check finite policy
 * normalization. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import { isRedMoonPreset } from "../../../src/rulesets";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { redMoonTwelveConfig } from "../../../src/runtime/scenarios/red_moon_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { Role, WinCondition, WitchSelfHealRule } from "../../../src/core/domain/identity";
import type { BoardConfig } from "../../../src/core/domain/board";
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
for (const policy of ["ends_game", "forbidden"] as const)
  test("Red Moon public board roundtrip " + policy, async () => {
    const config = structuredClone(redMoonTwelveConfig);
    config.redMoon!.lastWolfBlastPolicy = policy;
    expect(isRedMoonPreset(config)).toBe(true);
    expect(boardConfigSchema.parse(config)).toEqual(config);
    expect(bootstrapGame(config).playerIds).toHaveLength(12);
    const id = "awa_red_moon_12_" + policy + "_v1";
    const definition = await Bun.file(
      new URL("../../../../configs.example/boards/" + id + ".json", import.meta.url),
    ).json();
    expect(parseBoardDefinition(definition).config).toEqual(config);
    expect(boardDefinitionFromConfig(id, config)).toEqual(definition);
  });
const invalid: Array<[string, (c: BoardConfig) => void]> = [
  [
    "missing Red Moon",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.RedMoonApostle)!.role = Role.Wolf;
    },
  ],
  [
    "wrong count",
    (c) => {
      c.roleSetups[0]!.count++;
    },
  ],
  [
    "unsupported guard",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.Idiot)!.role = Role.Guard;
    },
  ],
  [
    "policy",
    (c) => {
      c.redMoon!.lastWolfBlastPolicy = "other" as never;
    },
  ],
  [
    "extra parameter",
    (c) => {
      Object.assign(c.redMoon!, { reset: true });
    },
  ],
  [
    "self heal",
    (c) => {
      c.witch!.canSelfHeal = WitchSelfHealRule.FirstNightOnly;
    },
  ],
  [
    "different victory",
    (c) => {
      c.winConditions = [WinCondition.SlaughterCity];
    },
  ],
  [
    "optional seer",
    (c) => {
      c.seer!.actionPolicy = "awa_optional_v1";
    },
  ],
];
for (const [name, mutate] of invalid)
  test("Red Moon rejects " + name, () => {
    const config = structuredClone(redMoonTwelveConfig);
    mutate(config);
    expect(isRedMoonPreset(config)).toBe(false);
    expect(() => bootstrapGame(config)).toThrow("red_moon_preset_invalid");
  });
