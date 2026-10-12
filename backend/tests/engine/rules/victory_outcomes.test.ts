/**
 * Victory domain/engine integration verify explicit faction, individual and relationship winner membership.
 * Input: Literal memberships, original roster/state variants and scripted terminal cycles.
 * Output and independent oracle: Handwritten winner union/priority, survival-independent membership and checkpoint/record agreement.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Phase,
  Role,
  WinCondition,
  createVictoryComponent,
  type RoleComponent,
  type GameResult,
  type ActionRequest,
} from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { ConditionRegistry } from "../../../src/core/domain/registries/condition_registry";
import { WinConditionRegistry } from "../../../src/game/mechanisms/registries/win_condition_registry";
import { victoryDecision } from "../../../src/game/mechanisms/win_conditions/results";
import { PhaseManager } from "../../../src/game/engine/phase_manager";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { createDefaultRoleRegistry } from "../../../src/game/mechanisms";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";
import { readGameOutcome, readVictoryPoint } from "@ai-werewolf-arena/replay-contract";

const deck = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];
const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(
    { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] },
    { locale, fixedRoles: deck },
  );
function dead(world: ReturnType<typeof fixture>["world"], ids: number[]) {
  for (const id of ids) world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)!.alive = false;
}
const action = (request: ActionRequest) =>
  request.allowedTools.includes("kill_vote")
    ? { name: "kill_vote" as const, args: { target_id: null, abstain: true } }
    : request.allowedTools.includes("guard")
      ? { name: "guard" as const, args: { target_id: null, abstain: true } }
      : request.allowedTools.includes("check_identity")
        ? { name: "check_identity" as const, args: { target_id: 1 } }
        : request.allowedTools.includes("speak")
          ? { name: "speak" as const, args: { text: "raw" } }
          : null;

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: native conditions declare all faction winners including dead teammates and retain ordered condition priority`, () => {
    for (const mode of [
      WinCondition.SlaughterCity,
      WinCondition.SlaughterSide,
      WinCondition.WolfReachHalf,
    ]) {
      const { world } = fixture(locale);
      dead(world, [1, 2, 4]);
      const result = new ConditionRegistry(new WinConditionRegistry()).evaluate(world, mode);
      expect(result).toEqual({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 5, 6] },
          additional: [],
          winningPlayerIds: [3, 4, 5, 6],
        },
      });
    }
    const { world } = fixture(locale);
    dead(world, [3, 4]);
    const registry = new ConditionRegistry(new WinConditionRegistry());
    expect(
      registry.evaluateMany(world, [WinCondition.SlaughterSide, WinCondition.WolfReachHalf])!
        .reason,
    ).toBe("slaughter_side_completed");
    expect(
      registry.evaluateMany(world, [WinCondition.WolfReachHalf, WinCondition.SlaughterSide])!
        .reason,
    ).toBe("wolves_reach_half");
    dead(world, [1, 2, 5, 6]);
    expect(registry.evaluate(world, WinCondition.SlaughterCity)!.winner).toBe(Camp.Good); // Simultaneous all-dead priority.
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: win membership is independent of identity, true camp, survival and abilities; third-party gods do not count as good gods`, () => {
    const { world } = fixture(locale);
    const template = [{ kind: "faction" as const, faction: "wolf" as const }];
    world.addComponent(5, COMPONENT.Victory, createVictoryComponent(template));
    template.length = 0;
    const result = victoryDecision(world, { kind: "faction", faction: "wolf" }, "scenario_faction");
    expect(result.outcome).toEqual({
      kind: "victory",
      primary: { kind: "faction", faction: "wolf", winningPlayerIds: [1, 2, 5] },
      additional: [],
      winningPlayerIds: [1, 2, 5],
    });
    expect(world.getComponent<RoleComponent>(5, COMPONENT.Role)).toMatchObject({
      role: Role.Villager,
      camp: Camp.Good,
    });
    world.getComponent<RoleComponent>(3, COMPONENT.Role)!.camp = Camp.ThirdParty;
    dead(world, [4]);
    expect(
      new ConditionRegistry(new WinConditionRegistry()).evaluate(world, WinCondition.SlaughterSide)!
        .reason,
    ).toBe("slaughter_side_completed");
    const checkpoint = captureCheckpoint(
      world,
      { day: 1, phase: Phase.Night, gameOver: false, result: null },
      0,
      true,
      0,
    );
    expect(checkpoint.players[4].victory).toEqual({
      affiliations: [{ kind: "faction", faction: "wolf" }],
    });
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: individual, relationship and additional faction wins explicitly declare a deduplicated winner union`, () => {
    const { world } = fixture(locale);
    world.addComponent(
      5,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "individual", goalId: "scenario_solo" }]),
    );
    for (const id of [4, 6])
      world.addComponent(
        id,
        COMPONENT.Victory,
        createVictoryComponent([
          { kind: "faction", faction: "good" },
          { kind: "relationship", groupId: "scenario_pair" },
        ]),
      );
    dead(world, [4]);
    const result = victoryDecision(
      world,
      { kind: "individual", playerId: 5, goalId: "scenario_solo" },
      "scenario_multi",
      [
        { kind: "faction", faction: "good" },
        { kind: "relationship", groupId: "scenario_pair" },
      ],
    );
    expect(result).toEqual({
      winner: null,
      reason: "scenario_multi",
      outcome: {
        kind: "victory",
        primary: {
          kind: "individual",
          playerId: 5,
          goalId: "scenario_solo",
          winningPlayerIds: [5],
        },
        additional: [
          { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 6] },
          { kind: "relationship", groupId: "scenario_pair", winningPlayerIds: [4, 6] },
        ],
        winningPlayerIds: [3, 4, 5, 6],
      },
    });
    expect(() =>
      victoryDecision(world, { kind: "relationship", groupId: "missing" }, "scenario_invalid"),
    ).toThrow("victory_target_has_no_members");
    expect(() =>
      victoryDecision(world, { kind: "faction", faction: "good" }, "scenario_invalid", [
        { kind: "faction", faction: "good" },
      ]),
    ).toThrow();
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["individual", "relationship"] as const)
    test(`${locale}/${kind}: injected goal rules only win at their declared checkpoint and the engine seals immutable result/event copies`, async () => {
      const { world } = fixture(locale),
        config = { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] };
      const target =
        kind === "individual"
          ? { kind, playerId: 5, goalId: "scenario_solo" }
          : { kind, groupId: "scenario_pair" };
      if (kind === "individual")
        world.addComponent(
          5,
          COMPONENT.Victory,
          createVictoryComponent([{ kind, goalId: "scenario_solo" }]),
        );
      else
        for (const id of [5, 6])
          world.addComponent(
            id,
            COMPONENT.Victory,
            createVictoryComponent([{ kind, groupId: "scenario_pair" }]),
          );
      const checkpoint = kind === "individual" ? "exile_settled" : "night_settled";
      const registry = new ConditionRegistry(
        new WinConditionRegistry([
          {
            id: WinCondition.SlaughterCity,
            checkpoints: [checkpoint],
            evaluate: () => victoryDecision(world, target, "scenario_goal"),
          },
        ]),
      );
      expect(registry.evaluate(world, WinCondition.SlaughterCity)).toBeNull();
      expect(registry.evaluate(world, WinCondition.SlaughterCity, "day_interrupted")).toBeNull();
      const manager = new PhaseManager(
        world,
        config,
        new ToolGateway(),
        createDefaultRoleRegistry(),
        registry,
        new DamageResolutionSystem(),
      );
      const result = await manager.runSingleCycle({
        async getAction(request) {
          return request.allowedTools.includes("vote")
            ? { name: "vote", args: { target_id: 5, abstain: false } }
            : action(request);
        },
      });
      expect(result.gameOver).toBe(true);
      expect(result.result!.winner).toBeNull();
      expect(result.result!.outcome).toEqual({
        kind: "victory",
        primary: { ...target, winningPlayerIds: kind === "individual" ? [5] : [5, 6] },
        additional: [],
        winningPlayerIds: kind === "individual" ? [5] : [5, 6],
      });
      expect(result.result!.decidedAt).toEqual({
        day: 1,
        phase: kind === "individual" ? Phase.Voting : Phase.Day,
        checkpoint,
      });
      const resultBefore = structuredClone(result.result!);
      if (result.result!.outcome.kind === "victory")
        result.result!.outcome.winningPlayerIds.length = 0;
      expect(manager.debugResult()).toEqual(resultBefore);
      const event = manager.getEvents().find((event) => event.type === "game_over")!;
      expect(event.payload).toEqual(resultBefore);
      if (event.payload.outcome.kind === "victory")
        event.payload.outcome.winningPlayerIds.length = 0;
      expect(manager.debugResult()).toEqual(resultBefore);
      expect(manager.getEvents().find((event) => event.type === "game_over")!.payload).toEqual(
        resultBefore,
      );
      const before = manager.getEvents().length;
      await manager.runSingleCycle({
        async getAction() {
          throw new Error("unexpected-post-terminal-request");
        },
      });
      expect(manager.getEvents().length).toBe(before);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: max-day termination has an explicit no-winner point and exactly one terminal event`, async () => {
    const game = fixture(locale),
      provider = {
        async getAction(request: ActionRequest) {
          return request.allowedTools.includes("vote")
            ? { name: "vote" as const, args: { target_id: null, abstain: true } }
            : action(request);
        },
      };
    await game.phaseManager.runSingleCycle(provider, 1);
    const result = await game.phaseManager.runSingleCycle(provider, 1);
    expect(result.result).toEqual({
      winner: null,
      reason: "max_days_reached",
      outcome: { kind: "no_winner" },
      decidedAt: { day: 2, phase: Phase.Night, checkpoint: "max_days_reached" },
    });
    expect(
      game.phaseManager.getEvents().filter((event) => event.type === "game_over"),
    ).toHaveLength(1);
    expect(game.world.activeDeathActionCount).toBe(0);
  });

test("strict shared outcome readers reject malformed facts and never invoke foreign accessors", () => {
  const valid: Extract<ReturnType<typeof readGameOutcome>, { kind: "victory" }> = {
    kind: "victory",
    primary: { kind: "faction", faction: "good", winningPlayerIds: [1, 3] },
    additional: [],
    winningPlayerIds: [1, 3],
  };
  expect(readGameOutcome(valid, [1, 2, 3])).toEqual(valid);
  const malformed = [
    { ...valid, winningPlayerIds: [1] },
    { ...valid, winningPlayerIds: [3, 1] },
    { ...valid, additional: [valid.primary] },
    {
      ...valid,
      primary: { kind: "individual", playerId: 2, goalId: "scenario_solo", winningPlayerIds: [1] },
    },
    { kind: "no_winner", winningPlayerIds: [] },
    { ...valid, primary: { ...valid.primary, faction: "other" } },
  ];
  for (const value of malformed) expect(() => readGameOutcome(value)).toThrow();
  expect(() => readGameOutcome(valid, [1, 2])).toThrow();
  let reads = 0;
  const accessor = { ...valid };
  Object.defineProperty(accessor, "primary", {
    get() {
      reads++;
      return valid.primary;
    },
    enumerable: true,
  });
  expect(() => readGameOutcome(accessor)).toThrow();
  expect(reads).toBe(0);
  expect(() => readGameOutcome(Object.create(valid))).toThrow();
  const copy = readGameOutcome(valid);
  if (copy.kind === "victory") copy.primary.winningPlayerIds.length = 0;
  expect(valid.primary.winningPlayerIds).toEqual([1, 3]);
  expect(readVictoryPoint({ day: 2, phase: "voting", checkpoint: "exile_settled" })).toEqual({
    day: 2,
    phase: "voting",
    checkpoint: "exile_settled",
  });
  expect(() =>
    readVictoryPoint({ day: 2, phase: Phase.Day, checkpoint: "exile_settled" }),
  ).toThrow();
});

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

test("final sealing rejects a structurally valid forged membership even from a custom condition", async () => {
  const { world } = fixture("en"),
    config = { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] };
  const registry = new ConditionRegistry(
    new WinConditionRegistry([
      {
        id: WinCondition.SlaughterCity,
        evaluate: () => ({
          winner: Camp.Good,
          reason: "scenario_forged",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction: "good", winningPlayerIds: [1] },
            additional: [],
            winningPlayerIds: [1],
          },
        }),
      },
    ]),
  );
  const manager = new PhaseManager(
    world,
    config,
    new ToolGateway(),
    createDefaultRoleRegistry(),
    registry,
    new DamageResolutionSystem(),
  );
  await expect(
    manager.runSingleCycle({
      async getAction(request) {
        return action(request);
      },
    }),
  ).rejects.toThrow("game_result_membership_invalid");
  expect(manager.getSnapshot().gameOver).toBe(false);
  expect(manager.getEvents().filter((event) => event.type === "game_over")).toEqual([]);
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
