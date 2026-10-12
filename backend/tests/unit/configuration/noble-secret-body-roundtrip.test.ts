/**
 * Unit tests: Noble and Secret Body configuration uses immutable public board examples and
 * four policy combinations; literal schema, reverse-config and bootstrap expectations
 * check exact roundtrip and invalid variants. Inputs and expected outcomes remain the
 * original literal or immutable-fixture oracle; these module assertions invoke no model or
 * complete-game driver.
 */
import { expect, test } from "bun:test";
import { isNobleSecretBodyPreset, isDemonHunterPreset } from "../../../src/rulesets";
import { nobleSecretBodyTwelveConfig } from "../../../src/runtime/scenarios/noble_secret_body_twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { boardConfigSchema } from "../../../src/core/domain/board_schema";
import { Role, WitchSelfHealRule, type BoardConfig } from "../../../src/core";
for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
  for (const body of ["awa_nonconsecutive_nights_v1", "awa_repeat_v1"] as const)
    test(`finite noble/body public four-policy roundtrip ${wolf}/${body}`, async () => {
      const config = nobleSecretBodyTwelveConfig(wolf, body),
        id = `awa_noble_secret_body_12_${wolf}_${body === "awa_repeat_v1" ? "repeat" : "nonconsecutive"}_v1`,
        definition = await Bun.file(
          new URL(`../../../../configs.example/boards/${id}.json`, import.meta.url),
        ).json();
      expect(isNobleSecretBodyPreset(config)).toBe(true);
      expect(isDemonHunterPreset(config)).toBe(true);
      expect(boardConfigSchema.parse(config)).toEqual(config);
      expect(parseBoardDefinition(definition).config).toEqual(config);
      expect(boardDefinitionFromConfig(id, config)).toEqual(definition);
      expect(bootstrapGame(config).playerIds).toHaveLength(12);
    });
const invalid: Array<[string, (c: BoardConfig) => void]> = [
  [
    "mixed guard",
    (c) => (c.roleSetups.find((r) => r.role === Role.AwakenedIdiot)!.role = Role.Guard),
  ],
  [
    "missing noble",
    (c) => (c.roleSetups.find((r) => r.role === Role.NightNoble)!.role = Role.Wolf),
  ],
  ["wrong count", (c) => (c.roleSetups.find((r) => r.role === Role.Wolf)!.count = 2)],
  ["late sheriff", (c) => (c.sheriff!.electionPolicy = "awa_final_candidates_v1")],
  ["wrong badge", (c) => (c.sheriff!.badgePolicy = "awa_next_seat_v1")],
  ["no PK", (c) => (c.voting!.exilePolicy = "awa_direct_v1")],
  ["different tie", (c) => (c.tieBreaker!.exileVote = "min_id")],
  ["self healing", (c) => (c.witch!.canSelfHeal = WitchSelfHealRule.Always)],
];
for (const [name, change] of invalid)
  test(`noble/body rejects ${name} in direct and public input`, () => {
    const c = nobleSecretBodyTwelveConfig();
    change(c);
    expect(isNobleSecretBodyPreset(c)).toBe(false);
    expect(isDemonHunterPreset(c)).toBe(false);
    expect(() => bootstrapGame(c)).toThrow("noble_secret_body_preset_invalid");
    expect(() => boardDefinitionFromConfig("invalid_noble_board", c)).toThrow();
  });
