/**
 * Integration/scenario tests for pure white configuration configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import { expect, test } from "bun:test";
import { isPureWhitePreset } from "../../../src/rulesets";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { pureWhiteTwelveConfig } from "../../../src/runtime/scenarios/pure_white_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { Role, WinCondition, WitchSelfHealRule } from "../../../src/core/domain/model";
import type { BoardConfig } from "../../../src/core/domain/board";
for (const priority of ["awa_wolf_priority_v1", "awa_good_priority_v1"] as const) {
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly]) {
    test(`finite paired board round trip preserves ${priority}/${selfHeal}`, () => {
      const config = structuredClone(pureWhiteTwelveConfig);
      config.pureWhite!.eliminationPriority = priority;
      config.witch!.canSelfHeal = selfHeal;
      expect(isPureWhitePreset(config)).toBe(true);
      const definition = boardDefinitionFromConfig("pure-white-test", config);
      expect(parseBoardDefinition(definition).config).toEqual(config);
      expect(bootstrapGame(config).world.entityIds()).toHaveLength(12);
    });
  }
}
const invalid: Array<[string, (c: BoardConfig) => void]> = [
  [
    "missing pair",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.WolfWitch)!.role = Role.Wolf;
    },
  ],
  [
    "extra role",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.Guard)!.role = Role.Seer;
    },
  ],
  [
    "wrong count",
    (c) => {
      c.roleSetups.find((r) => r.role === Role.Wolf)!.count++;
    },
  ],
  [
    "city victory",
    (c) => {
      c.winConditions = [WinCondition.SlaughterCity];
    },
  ],
  [
    "mixed victory",
    (c) => {
      c.winConditions!.push(WinCondition.WolfReachHalf);
    },
  ],
  [
    "public reveal",
    (c) => {
      c.disclosure = { deathRevealPolicy: "invalid" as never };
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
    "unrecognized policy",
    (c) => {
      c.pureWhite!.policy = "other" as never;
    },
  ],
  [
    "unrecognized priority",
    (c) => {
      c.pureWhite!.eliminationPriority = "other" as never;
    },
  ],
  [
    "initial sheriff",
    (c) => {
      c.initialSheriffSeat = 1;
    },
  ],
  [
    "foreign event pack",
    (c) => {
      c.events = { pack: "other" as never };
    },
  ],
  [
    "no sheriff",
    (c) => {
      c.enableSheriff = false;
    },
  ],
];
for (const [name, mutate] of invalid) {
  test(`paired board rejects ${name} before gameplay`, () => {
    const config = structuredClone(pureWhiteTwelveConfig);
    mutate(config);
    expect(isPureWhitePreset(config)).toBe(false);
    expect(() => bootstrapGame(config)).toThrow("pure_white_preset_invalid");
    expect(() => boardDefinitionFromConfig("invalid-pure-white", config)).toThrow();
  });
}
test("null and extra configuration fields do not acquire a supported preset", () => {
  expect(
    isPureWhitePreset({
      ...pureWhiteTwelveConfig,
      winCondition: WinCondition.SlaughterSide,
      winConditions: null,
    }),
  ).toBe(false);
  expect(isPureWhitePreset({ ...pureWhiteTwelveConfig, unknownMechanism: {} })).toBe(false);
});

for (const priority of ["wolf", "good"] as const)
  for (const selfHeal of [WitchSelfHealRule.Disabled, WitchSelfHealRule.FirstNightOnly])
    test(`public paired board file preserves ${priority}/${selfHeal}`, async () => {
      const id = `awa_pure_white_12_${priority}_${selfHeal}_v1`;
      const raw = await Bun.file(
        new URL(`../../../../configs.example/boards/${id}.json`, import.meta.url),
      ).json();
      const board = parseBoardDefinition(raw);
      expect(board.definition.id).toBe(id);
      expect(board.config.pureWhite!.eliminationPriority).toBe(`awa_${priority}_priority_v1`);
      expect(board.config.witch!.canSelfHeal).toBe(selfHeal);
      expect(isPureWhitePreset(board.config)).toBe(true);
      expect(parseBoardDefinition(boardDefinitionFromConfig(id, board.config)).config).toEqual(
        board.config,
      );
      expect(bootstrapGame(board.config).world.entityIds()).toHaveLength(12);
    });
