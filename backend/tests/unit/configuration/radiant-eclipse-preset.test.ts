/**
 * Unit tests for radiant-eclipse-preset; Pure finite-board schema/reader/writer or safe diagnostic validation against literal configuration.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { isRadiantEclipsePreset } from "../../../src/rulesets";
import { boardConfigSchema } from "../../../src/domain/board-schema";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
const config: any = {
  boardSize: 12,
  enableSheriff: true,
  radiantEclipse: { policy: "awa_radiant_eclipse_v1" },
  roleSetups: [
    { role: "wolf", count: 3 },
    { role: "eclipse_maid", count: 1 },
    { role: "villager", count: 4 },
    { role: "seer", count: 1 },
    { role: "radiant_count", count: 1 },
    { role: "dreamer", count: 1 },
    { role: "witch", count: 1 },
  ],
  winConditions: ["slaughter_side"],
  dreamer: { protectionPolicy: "netease_2026_night_immunity_v1" },
  witch: {
    canSelfHeal: "disabled",
    knifeVisibility: "awa_with_heal_v1",
    potionPolicy: "awa_one_native_v1",
  },
  seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  voting: { exilePolicy: "awa_one_pk_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  sheriff: {
    electionPolicy: "awa_nomination_offstage_pk_v1",
    badgePolicy: "awa_holder_choice_v1",
    voteWeight: 1.5,
  },
  tieBreaker: {
    sheriffVote: "no_elimination",
    wolfKillVote: "min_id",
    exileVote: "no_elimination",
  },
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
};
test("literal sourced board uses internal Witch config names and is an accepted finite preset", () => {
  expect(boardConfigSchema.safeParse(config).success).toBe(true);
  expect(isRadiantEclipsePreset(config)).toBe(true);
});
test("real public writer/reader roundtrip retains finite policy and canonical Witch rules", () => {
  const publicBoard = boardDefinitionFromConfig("awa_radiant_eclipse_12_v1", config);
  const resolved = parseBoardDefinition(publicBoard).config;
  expect(resolved).toEqual(config);
});
test("private-state-style and noncanonical Witch fields cannot pass finite board eligibility", () => {
  const invalid = {
    ...config,
    witch: {
      selfHealRule: "disabled",
      knifeVisibility: "with_heal",
      potionPolicy: "awa_one_native_v1",
    },
  };
  expect(boardConfigSchema.safeParse(invalid).success).toBe(false);
  expect(isRadiantEclipsePreset(invalid)).toBe(false);
});
