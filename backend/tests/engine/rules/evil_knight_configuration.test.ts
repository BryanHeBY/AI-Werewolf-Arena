/**
 * Integration/scenario tests for evil knight configuration configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import { expect, test } from "bun:test";
import { isEvilKnightPreset } from "../../../src/rulesets";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { evilKnightTwelveConfig } from "../../../src/runtime/scenarios/evil_knight_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { Role, WinCondition, WitchSelfHealRule } from "../../../src/core/domain/identity";
import type { BoardConfig } from "../../../src/core/domain/board";
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
import { COMPONENT } from "../../../src/core/domain/components/names";
import type { RoleComponent } from "../../../src/core/domain/components/role";
import { getEvilKnightState } from "../../../src/game/mechanisms/roles/evil_knight/state";
for (const shotPolicy of ["night_shot_immune", "hunter_shot_bypasses"] as const) {
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly]) {
    test(`evil knight strict board roundtrip ${shotPolicy}/${selfHeal}`, () => {
      const config = structuredClone(evilKnightTwelveConfig);
      config.evilKnight!.shotPolicy = shotPolicy;
      config.witch!.canSelfHeal = selfHeal;
      expect(isEvilKnightPreset(config)).toBe(true);
      expect(boardConfigSchema.parse(config)).toEqual(config);
      expect(
        parseBoardDefinition(boardDefinitionFromConfig("evil-knight-test", config)).config,
      ).toEqual(config);
      const { world } = bootstrapGame(config);
      expect(world.entityIds()).toHaveLength(12);
      const knight = world
        .entityIds()
        .map((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role))
        .find((r) => r?.role === Role.EvilKnight)!;
      expect(getEvilKnightState(knight)).toEqual({
        policy: "awa_evil_knight_v1",
        shotPolicy,
        reflectionRemaining: 1,
      });
    });
  }
}
const invalid: Array<[string, (c: BoardConfig) => void]> = [
  [
    "missing knight",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.EvilKnight)!.role = Role.Wolf;
    },
  ],
  [
    "wrong deck count",
    (c) => {
      c.roleSetups[0]!.count++;
    },
  ],
  [
    "unsupported role",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.Guard)!.role = Role.Dreamer;
    },
  ],
  [
    "unknown gun policy",
    (c) => {
      c.evilKnight!.shotPolicy = "other" as never;
    },
  ],
  [
    "unknown role policy",
    (c) => {
      c.evilKnight!.policy = "other" as never;
    },
  ],
  [
    "unknown parameter",
    (c) => {
      Object.assign(c.evilKnight!, { reset: true });
    },
  ],
  [
    "unbounded self heal",
    (c) => {
      c.witch!.canSelfHeal = WitchSelfHealRule.Always;
    },
  ],
  [
    "double potion",
    (c) => {
      c.witch!.potionPolicy = "awa_both_native_experimental_v1";
    },
  ],
  [
    "optional seer",
    (c) => {
      c.seer!.actionPolicy = "awa_optional_v1";
    },
  ],
  [
    "different victory",
    (c) => {
      c.winConditions = [WinCondition.WolfReachHalf];
    },
  ],
  [
    "mixed victory",
    (c) => {
      c.winConditions!.push(WinCondition.SlaughterCity);
    },
  ],
  [
    "initial sheriff",
    (c) => {
      c.initialSheriffSeat = 1;
    },
  ],
];
for (const [name, mutate] of invalid) {
  test(`finite evil knight preset rejects ${name}`, () => {
    const config = structuredClone(evilKnightTwelveConfig);
    mutate(config);
    expect(isEvilKnightPreset(config)).toBe(false);
    expect(() => bootstrapGame(config)).toThrow("evil_knight_preset_invalid");
  });
}

for (const shot of ["night_shot_immune", "hunter_shot_bypasses"] as const) {
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly] as const) {
    test(`public evil knight board ${shot}/${selfHeal} loads and exactly roundtrips`, async () => {
      const path = new URL(
        `../../../../configs.example/boards/awa_evil_knight_12_${shot}_${selfHeal}_v1.json`,
        import.meta.url,
      );
      const definition = await Bun.file(path).json();
      const parsed = parseBoardDefinition(definition);
      expect(isEvilKnightPreset(parsed.config)).toBe(true);
      expect(parsed.config.evilKnight?.shotPolicy).toBe(shot);
      expect(parsed.config.witch?.canSelfHeal).toBe(selfHeal);
      expect(boardDefinitionFromConfig(definition.id, parsed.config)).toEqual(definition);
    });
  }
}
