/**
 * Recording integration tests check real source/lock fingerprints and explicit serialized membership wiring. Inputs are isolated source trees, real current build metadata and literal checkpoint declarations; source-hash changes, unchanged locks and original trace validation errors are the oracle. Native file reads and original temp cleanup remain explicit; no complete game or model runs.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Phase, Role, WinCondition, createVictoryComponent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { victoryDecision } from "../../../src/game/mechanisms/win_conditions/results";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";

const deck = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(
    { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] },
    { locale, fixedRoles: deck },
  );

test("an executed shared result decoder change invalidates the engine fingerprint without changing the lockfile", async () => {
  const { mkdir, writeFile } = await import("node:fs/promises"),
    path = await import("node:path");
  const { createTestTempDirectory } = await import("../../support/drivers/temp-directories");
  const { currentEngineVersion } =
    await import("../../../src/runtime/simulation/reproduction_context");
  const root = await createTestTempDirectory("awa-fingerprint-");
  for (const directory of [
    "backend/src/core",
    "backend/src/game",
    "backend/src/app",
    "packages/game-catalog/src",
    "packages/game-text/src",
    "packages/replay-contract/src",
  ])
    await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, "bun.lock"), "synthetic-lock");
  const reader = path.join(root, "packages/replay-contract/src/outcomes.ts");
  await writeFile(reader, "export const decision = 'first';\n");
  const first = await currentEngineVersion(root);
  await writeFile(reader, "export const decision = 'changed';\n");
  const second = await currentEngineVersion(root);
  expect(second.sourceHash).not.toBe(first.sourceHash);
  expect(second.lockHash).toBe(first.lockHash);
});

test("empty membership is explicit and serializable; invalid declarations fail at installation rather than final persistence", async () => {
  const { ReproductionTrace } = await import("../../../src/recording/reproduction");
  const { currentEngineVersion } =
    await import("../../../src/runtime/simulation/reproduction_context");
  const { world } = fixture("en");
  world.addComponent(5, COMPONENT.Victory, createVictoryComponent([]));
  expect(
    victoryDecision(world, { kind: "faction", faction: "good" }, "scenario_members").outcome,
  ).toEqual({
    kind: "victory",
    primary: { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 6] },
    additional: [],
    winningPlayerIds: [3, 4, 6],
  });
  expect(() => createVictoryComponent([{ kind: "individual", goalId: "bad name" }])).toThrow();
  expect(() => createVictoryComponent([{ kind: "relationship", groupId: "" }])).toThrow();
  expect(() =>
    createVictoryComponent([
      { kind: "faction", faction: "good" },
      { kind: "faction", faction: "good" },
    ]),
  ).toThrow();
  const engine = await currentEngineVersion();
  const trace = new ReproductionTrace(
    {
      engine,
      random: fixture("en").random.metadata,
      ruleset: { id: "awa_classic", version: "1.0.0" },
      boardId: "six_player_mvp",
      normalizedBoard: { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] },
      locale: "en",
      maxDays: 1,
      dealMode: "fixed",
      players: deck.map((role, index) => ({
        id: index + 1,
        name: `Player ${index + 1}`,
        role,
        camp: index < 2 ? Camp.Wolf : Camp.Good,
      })),
    },
    () => {},
  );
  trace.checkpoint(
    captureCheckpoint(
      world,
      { day: 1, phase: Phase.Night, gameOver: false, result: null },
      0,
      true,
      0,
    ),
    [],
  );
  expect(trace.build().checkpoints[0].players[4].victory).toEqual({ affiliations: [] });
});
