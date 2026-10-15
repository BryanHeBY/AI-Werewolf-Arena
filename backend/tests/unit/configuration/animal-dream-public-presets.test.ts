/**
 * Unit tests check public Animal Dream board qualification and explicit policy ordering. Inputs are literal old Bear boards and four Cat/Puffer policy variants; exact parse rejection and normalized policy fields are the oracle. Bootstrap verifies the accepted roster without executing a phase or death chain.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { animalInternalConfig } from "../../support/features/animal-dream/builders/roster";
import { Role, type BoardConfig } from "../../../src/domain";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { WinCondition } from "../../../src/domain/model";

const fixed = [
  Role.WolfBeauty,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.WhiteCat,
  Role.FoxCub,
  Role.Bear,
  Role.Pufferfish,
];

test("A public old Bear board cannot enable Animal-only dawn strategy", () => {
  const c = {
    boardSize: 6,
    roleSetups: [
      { role: Role.Wolf, count: 2 },
      { role: Role.Villager, count: 3 },
      { role: Role.Bear, count: 1 },
    ],
    winConditions: [WinCondition.SlaughterCity],
    enableSheriff: false,
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [] },
    tieBreaker: { exileVote: "no_elimination", wolfKillVote: "min_id" },
  } as BoardConfig;
  const d = boardDefinitionFromConfig("old_bear_a", c);
  d.roles.bear = { signalPolicy: "netease_dawn_live_v1" };
  expect(() => parseBoardDefinition(d)).toThrow();
});

test("A four public presets retain choices regardless explicit role parameter order", () => {
  for (const skip of ["awa_wait_for_actual_exile_v1", "awa_expire_on_skipped_day_v1"] as const)
    for (const ballot of ["awa_final_ballot_v1", "awa_first_ballot_v1"] as const) {
      const c = {
        ...animalInternalConfig(),
        whiteCat: { skippedVotePolicy: skip },
        pufferfish: { ballotPolicy: ballot },
      } as unknown as BoardConfig;
      const d = boardDefinitionFromConfig("animal_a", c);
      for (const rev of [false, true]) {
        const entries = Object.entries(d.roles);
        if (rev) entries.reverse();
        const parsed = parseBoardDefinition({ ...d, roles: Object.fromEntries(entries) }).config;
        expect(parsed.whiteCat?.skippedVotePolicy).toBe(skip);
        expect(parsed.pufferfish?.ballotPolicy).toBe(ballot);
        expect(parsed.bear?.signalPolicy).toBe("netease_dawn_live_v1");
        expect(bootstrapGame(parsed, { fixedRoles: fixed }).world.getAliveEntityIds()).toHaveLength(
          12,
        );
      }
    }
});
