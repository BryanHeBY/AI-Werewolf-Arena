/**
 * Unit tests: Nightmare configuration reads immutable public examples and mutates explicit
 * fear/pack policies; exact roundtrip and named rejection assertions check the finite
 * board predicate. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import { isNightmarePreset } from "../../../src/rulesets";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { nightmareTwelveConfig } from "../../../src/runtime/scenarios/nightmare_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { Role, WinCondition, WitchSelfHealRule } from "../../../src/domain/identity";
import type { BoardConfig } from "../../../src/domain/board";
import { boardConfigSchema } from "../../../src/domain/board-schema";
for (const fear of ["optional", "required_when_legal"] as const)
  for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
    test(`nightmare finite board and public JSON roundtrip ${fear}/${wolf}`, async () => {
      const config = structuredClone(nightmareTwelveConfig);
      config.nightmareShadow!.fearActionPolicy = fear;
      config.nightmareShadow!.wolfActionPolicy = wolf;
      expect(isNightmarePreset(config)).toBe(true);
      expect(boardConfigSchema.parse(config)).toEqual(config);
      expect(bootstrapGame(config).world.entityIds()).toHaveLength(12);
      const id = `awa_nightmare_12_${fear}_${wolf}_v1`;
      const definition = await Bun.file(
        new URL(`../../../../configs.example/boards/${id}.json`, import.meta.url),
      ).json();
      expect(parseBoardDefinition(definition).config).toEqual(config);
      expect(boardDefinitionFromConfig(id, config)).toEqual(definition);
    });
const invalid: Array<[string, (c: BoardConfig) => void]> = [
  [
    "missing nightmare",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.NightmareShadow)!.role = Role.Wolf;
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
      c.roleSetups.find((r) => r.role === Role.Dreamer)!.role = Role.Guard;
    },
  ],
  [
    "fear policy",
    (c) => {
      c.nightmareShadow!.fearActionPolicy = "other" as never;
    },
  ],
  [
    "wolf policy",
    (c) => {
      c.nightmareShadow!.wolfActionPolicy = "other" as never;
    },
  ],
  [
    "extra parameter",
    (c) => {
      Object.assign(c.nightmareShadow!, { reset: true });
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
    "dream immunity",
    (c) => {
      c.dreamer!.protectionPolicy = "netease_2026_night_immunity_v1";
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
  test(`nightmare finite preset rejects ${name}`, () => {
    const config = structuredClone(nightmareTwelveConfig);
    mutate(config);
    expect(isNightmarePreset(config)).toBe(false);
    expect(() => bootstrapGame(config)).toThrow("nightmare_preset_invalid");
  });
