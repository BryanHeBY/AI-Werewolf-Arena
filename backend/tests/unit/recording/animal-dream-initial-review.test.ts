/**
 * Unit tests: Animal archive initial-state validation uses bootstrap checkpoint zero and
 * forged future Fox state; explicit accepted/rejected prefixes check recorded first-night
 * authority. Inputs and expected outcomes remain the original literal or immutable-fixture
 * oracle; these module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { animalInternalConfig } from "../../support/features/animal-dream/builders/roster";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";
import { parseReproductionRecord } from "../../../src/recording/reproduction";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { Role, Phase, type BoardConfig } from "../../../src/domain";
const roles = [
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
function base() {
  const board = animalInternalConfig() as unknown as BoardConfig,
    g = bootstrapGame(board, { fixedRoles: roles }),
    events = g.phaseManager.getEvents(),
    cp = captureCheckpoint(g.world, g.phaseManager.getSnapshot(), 0, true, events.length);
  const record: any = {
    schemaVersion: 2,
    finalized: false,
    metadata: {
      engine: { id: "awa-engine", sourceHash: "0".repeat(64), lockHash: "0".repeat(64) },
      random: g.random.metadata,
      ruleset: { id: "awa_classic", version: "1.0.0" },
      boardId: "animal_initial_a",
      normalizedBoard: board,
      locale: "zh-CN",
      maxDays: 8,
      dealMode: "fixed",
      players: cp.players.map((p) => ({ id: p.id, name: p.name, role: p.role, camp: p.camp })),
    },
    decisions: [],
    checkpoints: [cp],
    events,
    operations: [],
    termination: null,
  };
  return { record, g };
}
test("A real bootstrap CP0 baseline accepted", () =>
  expect(() => parseReproductionRecord(base().record)).not.toThrow());
test("A forged settled Fox N2 request without any real night opening rejected", () => {
  const { record: r, g } = base(),
    request = new GameActionRequestFactory(g.world, [], 2).create({
      phase: Phase.Night,
      actorId: 10,
      allowedTools: ["fox_distract"],
      stage: "fox_distract",
      requiresAction: true,
      summary: { key: "request.summary.night_action" },
      context: {
        allow_fallback: false,
        action_failure_policy: "error",
        fox_candidates: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
    });
  r.decisions.push({
    actorId: 10,
    day: 2,
    stage: "fox_distract",
    turn: 1,
    request,
    openedAtEventCount: 0,
    openedAfterSettlement: 0,
    settleOrder: 1,
    outcome: { kind: "action", action: { name: "fox_distract", args: { target_id: 1 } } },
  });
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("A CP0 impossible nonzero operation and settlement counters rejected", () => {
  const { record: r } = base();
  r.checkpoints[0].operationCount = 99;
  r.checkpoints[0].decisionCount = 87;
  r.checkpoints[0].settlementCount = 76;
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("A CP0 foreign owner effect and impossible unit are rejected", () => {
  const { record: r } = base();
  r.checkpoints[0].animalDream.effect = {
    day: 9,
    targetId: 8,
    knifeBlocked: true,
    beautyBlocked: true,
  };
  r.checkpoints[0].animalDream.unit = {
    number: 45,
    day: 9,
    kind: "exile",
    status: "closed",
    expiryPrepared: true,
    expiryCatId: 9,
    finalRound: 2,
    ballots: [],
    puffer: null,
  };
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("A original CP0 identity camp must match metadata", () => {
  const { record: r } = base();
  r.checkpoints[0].players.find((p: any) => p.id === 9).camp = "wolf";
  expect(() => parseReproductionRecord(r)).toThrow();
});
