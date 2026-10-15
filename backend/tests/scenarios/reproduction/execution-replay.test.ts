/**
 * 负责完整与失败对局的复现集成场景，核对原请求因果。
 * 输入为观察／脚本记录、并行／checkpoint／provider 注入失败及非法版本；输出由原事件、决定、操作、checkpoint 相等与精确首失败核对。
 * 不调用计费模型，不改写预期 fixture 或 Tape。
 */
import { readReplayManifest } from "@ai-werewolf-arena/replay-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { Role, WitchSelfHealRule } from "../../../src/domain";
import { expect, spyOn, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../src/app/config/resolve-game-setup";
import { runGame } from "../../../src/app/game-runner";
import * as factory from "../../../src/app/player-agent-factory";
import { BaselineBotActionProvider } from "../../../src/agents/baseline/privileged";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import { ObservedBot } from "../../../src/agents/providers/observed-bot";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

const fixtures = path.resolve(import.meta.dir, "../../../../configs.example");

for (const boardId of ["six_player_mvp", "twelve_player_standard"]) {
  test(`${boardId}: actual recorded decisions reproduce every checkpoint, observation, event and domain operation`, async () => {
    const root = await createTestTempDirectory("awa-action-records-");
    const output = await createTestTempDirectory("awa-action-replays-");
    const board = await loadBoardDefinition(fixtures, boardId);
    const simulated = await simulateGames(board, {
      seeds: ["regression:0", "regression:1", "regression:2"],
      recordRoot: root,
    });
    for (const game of simulated.games) {
      const record = await readReproduction(path.join(game.recordDir, "reproduction.json"));
      expect(record.finalized).toBe(true);
      expect(record.decisions.every((entry) => entry.outcome.kind === "action")).toBe(true);
      const replayed = await replayReproduction(record, output);
      expect(replayed.snapshot.result).toEqual(game.result);
      expect(replayed.eventCount).toBe(record.events.length);
      expect(replayed.decisionCount).toBe(record.decisions.length);
      const manifest = readReplayManifest(
        JSON.parse(await readFile(path.join(game.recordDir, "manifest.json"), "utf8")),
      );
      expect(manifest.files.reproduction).toBe("reproduction.json");
      const publicReplay = readReplayDocument(
        JSON.parse(await readFile(path.join(game.recordDir, "replay.json"), "utf8")),
      );
      expect(publicReplay.schemaVersion).toBe(2);
      expect(publicReplay.meta.locale).toBe(record.metadata.locale);
      expect((publicReplay as { reproduction?: unknown }).reproduction).toBeUndefined();
      expect(
        (publicReplay as { metadata?: { engine?: unknown } }).metadata?.engine,
      ).toBeUndefined();
    }
  });
}

test("incompatible and altered recordings fail explicitly before being accepted as reproduced", async () => {
  const root = await createTestTempDirectory("awa-record-validation-");
  const output = await createTestTempDirectory("awa-record-rejects-");
  const board = await loadBoardDefinition(fixtures, "six_player_mvp");
  const simulated = await simulateGames(board, { seeds: ["reject-record"], recordRoot: root });
  const original = await readReproduction(
    path.join(simulated.games[0].recordDir, "reproduction.json"),
  );
  const modify = async (change: (record: any) => void, code: string) => {
    const record = structuredClone(original);
    change(record);
    await expect(replayReproduction(record, output)).rejects.toThrow(code);
  };
  await modify((record) => {
    record.schemaVersion = 99;
  }, "reproduction_schema_not_supported");
  await modify((record) => {
    record.schemaVersion = 1;
  }, "reproduction_schema_not_supported");
  await modify((record) => {
    record.metadata.engine.sourceHash = "0".repeat(64);
  }, "reproduction_engine_or_lock_incompatible");
  await modify((record) => {
    record.metadata.engine.lockHash = "0".repeat(64);
  }, "reproduction_engine_or_lock_incompatible");
  await modify((record) => {
    record.metadata.random.algorithm = "unknown_rng";
  }, "reproduction_rng_incompatible");
  await modify((record) => {
    record.metadata.random.seed = "changed-seed-that-was-never-dealt";
  }, "reproduction_initial_state_mismatch");
  await modify((record) => {
    record.metadata.ruleset.version = "999.0.0";
  }, "reproduction_ruleset_incompatible");
  await modify((record) => {
    record.finalized = false;
  }, "reproduction_not_finalized");
  await modify((record) => {
    record.decisions.push(structuredClone(record.decisions[0]));
  }, "reproduction_settlement_order_invalid");
  await modify((record) => {
    record.decisions[0].request.context.visible_events = [];
  }, "reproduction_observation_mismatch");
  await modify((record) => {
    record.checkpoints[1].players[0].alive = !record.checkpoints[1].players[0].alive;
  }, "reproduction_checkpoint_mismatch");
  await modify((record) => {
    record.events.find((event: any) => event.type === "wolf_tactical_order").audience = [];
  }, "reproduction_events_mismatch");
  await modify((record) => {
    delete record.events.find((event: any) => event.type === "wolf_tactical_order").audience;
  }, "reproduction_events_mismatch");
  await modify((record) => {
    record.events.find((event: any) => event.type === "wolf_tactical_order").audience = [2, 1];
  }, "reproduction_record_invalid");
  await modify((record) => {
    record.events.find((event: any) => event.type === "wolf_tactical_order").audience = [1, 1];
  }, "reproduction_record_invalid");
  await modify((record) => {
    record.events[0].audience = [1];
  }, "reproduction_record_invalid");
  await modify((record) => {
    record.operations.pop();
  }, "reproduction_operations_mismatch");
  await modify((record) => {
    record.decisions[0].settleOrder = record.decisions[1].settleOrder;
  }, "reproduction_settlement_order_invalid");
  await modify((record) => {
    record.decisions[0].request.context.turn_constraints.summary_message = {
      key: "missing.translation.key",
    };
  }, "reproduction_record_invalid");
  await modify((record) => {
    record.decisions[0].request.context.turn_constraints.summary_message = { key: "turn.minimum" };
  }, "reproduction_record_invalid");
  await modify((record) => {
    record.decisions[0].request.context.retry_notice_message = {
      key: "request.retry.wolf_vote",
      parameters: { unused: "raw" },
    };
  }, "reproduction_record_invalid");
  await modify((record) => {
    record.termination.winner = record.termination.winner === "good" ? "wolf" : "good";
  }, "reproduction_termination_invalid");
});

for (const fault of ["transport", "malformed_action"] as const) {
  test(`${fault}: runner saves a partial failure and offline replay reaches the same engine state`, async () => {
    const root = await createTestTempDirectory("awa-recorded-failure-");
    const output = await createTestTempDirectory("awa-replayed-failure-");
    const runtime = parseRuntimeConfig({
      providers: {
        default: "fake",
        items: {
          fake: {
            type: "openai",
            apiKey: "PRIVATE_AUTH_KEY",
            baseURL: "https://user:PRIVATE_URL_PASSWORD@example.invalid",
          },
        },
      },
      agents: {
        default: "fake",
        items: { fake: { kind: "llm", provider: "fake", model: "fake" } },
      },
      game: { seed: "record-failure" },
      debugSummary: { agent: { enabled: false } },
    });
    const setup = resolveGameSetup(runtime, {
      recordRootDir: root,
      maxDays: 30,
      streamEvents: false,
      color: false,
    });
    const transportError = new Error("PRIVATE_TRANSPORT_ERROR_WITH_TOKEN");
    const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(
      async (options) => {
        const baseline = new BaselineBotActionProvider(options.world);
        return {
          kind: "llm",
          runtimeState: { closed: false },
          async close() {},
          provider: {
            async getAction(request) {
              if (fault === "transport" && request.context.stage === "wolf_vote")
                throw transportError;
              if (fault === "malformed_action" && request.context.stage === "day_speech")
                return { name: "speak", args: {} } as any;
              return baseline.getAction(request);
            },
          },
        };
      },
    );
    try {
      await expect(runGame(setup)).rejects.toThrow();
      const [session] = await readdir(root);
      const raw = await readFile(path.join(root, session, "reproduction.json"), "utf8");
      for (const secret of [
        "PRIVATE_AUTH_KEY",
        "PRIVATE_URL_PASSWORD",
        "PRIVATE_TRANSPORT_ERROR_WITH_TOKEN",
      ])
        expect(raw).not.toContain(secret);
      const record = await readReproduction(path.join(root, session, "reproduction.json"));
      expect(record.checkpoints.at(-1)?.complete).toBe(false);
      expect(record.termination?.reason).toBe("runtime_error");
      const replayed = await replayReproduction(record, output);
      expect(replayed.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
      expect(replayed.eventCount).toBe(record.events.length);
      expect(replayed.sourceTermination?.reason).toBe("runtime_error");
      const altered = structuredClone(record);
      altered.termination!.reason = "completed";
      await expect(replayReproduction(altered, output)).rejects.toThrow(
        "reproduction_termination_invalid",
      );
    } finally {
      create.mockRestore();
    }
  });
}

test("a parallel phase reproduces the first failure before cancellation of an earlier waiting request", async () => {
  const root = await createTestTempDirectory("awa-causal-record-");
  const output = await createTestTempDirectory("awa-causal-replay-");
  const board = await loadBoardDefinition(fixtures, "twelve_player_standard");
  const runtime = parseRuntimeConfig({
    providers: { default: "fake", items: { fake: { type: "openai", apiKey: "unused" } } },
    agents: { default: "fake", items: { fake: { kind: "llm", provider: "fake", model: "fake" } } },
    game: { board: "twelve_player_standard", seed: "parallel-failure" },
    debugSummary: { agent: { enabled: false } },
  });
  const setup = resolveGameSetup(
    runtime,
    { recordRootDir: root, maxDays: 30, maxRuntimeMs: 10000, streamEvents: false, color: false },
    board,
  );
  const first = new TypeError("first_phase_failure");
  const cancelled = Object.assign(new Error("close_cancelled"), { name: "AbortError" });
  let cancel!: (error: Error) => void;
  const waiting = new Promise<null>((_resolve, reject) => {
    cancel = reject;
  });
  const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(async (options) => {
    const baseline = new BaselineBotActionProvider(options.world);
    return {
      kind: "llm",
      runtimeState: { closed: false },
      async close() {
        cancel(cancelled);
      },
      provider: {
        async getAction(request) {
          if (request.context.stage === "sheriff_nomination" && request.actorId === 1)
            return waiting;
          if (request.context.stage === "sheriff_nomination" && request.actorId === 2) throw first;
          return baseline.getAction(request);
        },
      },
    };
  });
  try {
    const failure = await runGame(setup).then(
      () => null,
      (error) => error,
    );
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors).toEqual([first, cancelled]);
    const [session] = await readdir(root);
    const record = await readReproduction(path.join(root, session, "reproduction.json"));
    const nominees = record.decisions.filter((decision) => decision.stage === "sheriff_nomination");
    expect(nominees.find((decision) => decision.actorId === 2)!.settleOrder).toBeLessThan(
      nominees.find((decision) => decision.actorId === 1)!.settleOrder!,
    );
    expect(record.checkpoints.at(-1)!.failure?.name).toBe("TypeError");
    expect((await replayReproduction(record, output)).snapshot).toEqual(
      record.checkpoints.at(-1)!.snapshot,
    );
    const wrongError = structuredClone(record);
    wrongError.termination!.errors.find((error) => error.scope === "cycle")!.name = "RangeError";
    await expect(replayReproduction(wrongError, output)).rejects.toThrow(
      "reproduction_termination_invalid",
    );
    const wrongOpening = structuredClone(record);
    const firstNominee = wrongOpening.decisions.find(
      (decision) => decision.stage === "sheriff_nomination" && decision.actorId === 1,
    )!;
    firstNominee.openedAfterSettlement = firstNominee.settleOrder! - 1;
    await expect(replayReproduction(wrongOpening, output)).rejects.toThrow(
      "reproduction_opening_boundary_mismatch",
    );
  } finally {
    create.mockRestore();
  }
});

test("a game and checkpoint failure keep both errors and cannot seal an incomplete trace", async () => {
  const root = await createTestTempDirectory("awa-checkpoint-failure-");
  const runtime = parseRuntimeConfig({
    providers: { default: "fake", items: { fake: { type: "openai", apiKey: "unused" } } },
    agents: { default: "fake", items: { fake: { kind: "llm", provider: "fake", model: "fake" } } },
    game: { seed: "checkpoint-failure" },
    debugSummary: { agent: { enabled: false } },
  });
  const setup = resolveGameSetup(runtime, {
    recordRootDir: root,
    maxDays: 30,
    streamEvents: false,
    color: false,
  });
  const primary = new Error("original_action_failure");
  const secondary = new Error("checkpoint_failed");
  const originalCheckpoint = ReproductionTrace.prototype.checkpoint;
  const checkpoint = spyOn(ReproductionTrace.prototype, "checkpoint").mockImplementation(function (
    this: ReproductionTrace,
    value,
    events,
  ) {
    if (value.cycle > 0) throw secondary;
    originalCheckpoint.call(this, value, events);
  });
  const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(async () => ({
    kind: "llm",
    runtimeState: { closed: false },
    async close() {},
    provider: {
      async getAction() {
        throw primary;
      },
    },
  }));
  try {
    let failure: unknown;
    try {
      await runGame(setup);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors.slice(0, 2)).toEqual([primary, secondary]);
    const [session] = await readdir(root);
    const record = await readReproduction(path.join(root, session, "reproduction.json"));
    expect(record.finalized).toBe(false);
    const replay = readReplayDocument(
      JSON.parse(await readFile(path.join(root, session, "replay.json"), "utf8")),
    );
    expect(replay.result.reason).toBe("runtime_error");
  } finally {
    create.mockRestore();
    checkpoint.mockRestore();
  }
});

test("a real runner deadline produces an explicitly partial timeout recording", async () => {
  const root = await createTestTempDirectory("awa-timeout-record-");
  const output = await createTestTempDirectory("awa-timeout-replay-");
  const runtime = parseRuntimeConfig({
    providers: { default: "fake", items: { fake: { type: "openai", apiKey: "unused" } } },
    agents: { default: "fake", items: { fake: { kind: "llm", provider: "fake", model: "fake" } } },
    game: { seed: "timeout", maxRuntimeMs: 1 },
    debugSummary: { agent: { enabled: false } },
  });
  const setup = resolveGameSetup(runtime, {
    recordRootDir: root,
    maxDays: 30,
    streamEvents: false,
    color: false,
  });
  const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(async (options) => {
    await new Promise((done) => setTimeout(done, 20));
    return {
      kind: "llm",
      runtimeState: { closed: false },
      provider: new BaselineBotActionProvider(options.world),
      async close() {},
    };
  });
  try {
    const result = await runGame(setup);
    expect(result.snapshot.gameOver).toBe(false);
    const [session] = await readdir(root);
    const record = await readReproduction(path.join(root, session, "reproduction.json"));
    expect(record.termination?.reason).toBe("runtime_timeout");
    expect((await replayReproduction(record, output)).snapshot).toEqual(result.snapshot);
  } finally {
    create.mockRestore();
  }
});

test("simulation also preserves a decision error when checkpoint recording fails", async () => {
  const root = await createTestTempDirectory("awa-simulation-checkpoint-failure-");
  const board = await loadBoardDefinition(fixtures, "six_player_mvp");
  const primary = new Error("simulated_decision_failed");
  const secondary = new Error("simulated_checkpoint_failed");
  const decide = spyOn(ObservedBot.prototype, "decide").mockRejectedValue(primary);
  const originalCheckpoint = ReproductionTrace.prototype.checkpoint;
  const checkpoint = spyOn(ReproductionTrace.prototype, "checkpoint").mockImplementation(function (
    this: ReproductionTrace,
    value,
    events,
  ) {
    if (value.cycle > 0) throw secondary;
    originalCheckpoint.call(this, value, events);
  });
  try {
    let failure: unknown;
    try {
      await simulateGames(board, { seeds: ["checkpoint-failed"], recordRoot: root });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors.slice(0, 2)).toEqual([primary, secondary]);
  } finally {
    decide.mockRestore();
    checkpoint.mockRestore();
  }
});

for (const simultaneous of [false, true]) {
  test(`parallel vote retries preserve recorded opening boundaries (${simultaneous ? "all voters" : "one voter"})`, async () => {
    const root = await createTestTempDirectory("awa-vote-retry-record-");
    const output = await createTestTempDirectory("awa-vote-retry-replay-");
    const runtime = parseRuntimeConfig({
      providers: { default: "fake", items: { fake: { type: "openai", apiKey: "unused" } } },
      agents: {
        default: "fake",
        items: { fake: { kind: "llm", provider: "fake", model: "fake" } },
      },
      game: { seed: "parallel-retries" },
      debugSummary: { agent: { enabled: false } },
    });
    const setup = resolveGameSetup(runtime, {
      recordRootDir: root,
      maxDays: 30,
      streamEvents: false,
      color: false,
    });
    const retried = new Set<number>();
    const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(
      async (options) => {
        const baseline = new BaselineBotActionProvider(options.world);
        return {
          kind: "llm",
          runtimeState: { closed: false },
          async close() {},
          provider: {
            async getAction(request) {
              const action = await baseline.getAction(request);
              if (
                request.context.stage === "voting" &&
                !retried.has(request.actorId) &&
                (simultaneous || retried.size === 0)
              ) {
                retried.add(request.actorId);
                return { name: "vote", args: { target_id: 999, abstain: false } } as const;
              }
              return action;
            },
          },
        };
      },
    );
    try {
      const result = await runGame(setup);
      expect(result.snapshot.gameOver).toBe(true);
      const [session] = await readdir(root);
      const record = await readReproduction(path.join(root, session, "reproduction.json"));
      expect(
        record.decisions.some((decision) => decision.stage === "voting" && decision.turn > 1),
      ).toBe(true);
      expect((await replayReproduction(record, output)).snapshot).toEqual(result.snapshot);
    } finally {
      create.mockRestore();
    }
  });
}

test("offline reconstruction carries the explicit recorded language into the new public export", async () => {
  const root = await createTestTempDirectory("awa-reproduction-locale-");
  const output = await createTestTempDirectory("awa-reproduction-locale-out-");
  const board = await loadBoardDefinition(fixtures, "six_player_mvp");
  const simulated = await simulateGames(board, {
    seeds: ["locale-metadata"],
    recordRoot: root,
    locale: "en",
  });
  const record = await readReproduction(
    path.join(simulated.games[0].recordDir, "reproduction.json"),
  );
  const reconstructed = await replayReproduction(record, output);
  expect(reconstructed.snapshot.result).toEqual(simulated.games[0].result);
  const dirs = await readdir(output);
  expect(dirs.length).toBe(1);
  const replay = readReplayDocument(
    JSON.parse(await readFile(path.join(output, dirs[0], "replay.json"), "utf8")),
  );
  expect(replay.schemaVersion).toBe(2);
  expect(replay.meta.locale).toBe(record.metadata.locale);
});

test("actual Tape replay preserves internal legacy fields and supported ties without public-config coercion", async () => {
  const board = await loadBoardDefinition(fixtures, "six_player_mvp");
  const config = {
    ...board.config,
    witch: { canSelfHeal: WitchSelfHealRule.Always },
    knight: { enabledWindows: [] },
    sheriff: { voteWeight: 2 },
    initialSheriffSeat: 1,
    winCondition: board.config.winConditions![0],
    roleSetups: [...board.config.roleSetups, { role: Role.Hunter, count: 0 }],
    tieBreaker: { ...board.config.tieBreaker, exileVote: "min_seat" as const },
  };
  const root = await createTestTempDirectory("awa-legacy-internal-tape-");
  const output = await createTestTempDirectory("awa-legacy-internal-replay-");
  const simulated = await simulateGames(
    { ...board, config },
    { seeds: ["legacy-internal-fields"], recordRoot: root },
  );
  const record = await readReproduction(
    path.join(simulated.games[0].recordDir, "reproduction.json"),
  );
  expect(record.metadata.normalizedBoard).toEqual(config);
  const before = JSON.stringify(record);
  const replayed = await replayReproduction(record, output);
  expect(replayed.snapshot.result).toEqual(simulated.games[0].result);
  expect(replayed.eventCount).toBe(record.events.length);
  expect(JSON.stringify(record)).toBe(before);
});

for (const repeatPolicy of ["awa_last_action_v1", "netease_consecutive_nights_v1"] as const) {
  test(`${repeatPolicy}: recorded policy reproduces through actual checkpoints and observation matching`, async () => {
    const board = await loadBoardDefinition(fixtures, "six_player_mvp");
    const configured = { ...board, config: { ...board.config, guard: { repeatPolicy } } };
    const root = await createTestTempDirectory("awa-guard-policy-tape-");
    const output = await createTestTempDirectory("awa-guard-policy-replay-");
    const simulated = await simulateGames(configured, {
      seeds: ["guard-policy"],
      recordRoot: root,
    });
    const record = await readReproduction(
      path.join(simulated.games[0].recordDir, "reproduction.json"),
    );
    expect(record.metadata.normalizedBoard.guard).toEqual({ repeatPolicy });
    const before = JSON.stringify(record);
    const replayed = await replayReproduction(record, output);
    expect(replayed.snapshot.result).toEqual(simulated.games[0].result);
    expect(replayed.decisionCount).toBe(record.decisions.length);
    expect(JSON.stringify(record)).toBe(before);
  });
}

for (const campInspection of ["awa_inheritance_v1", "netease_2020_good_v1"] as const) {
  test(`${campInspection}: named Hidden Wolf camp policy is recorded and reproduces every request and checkpoint`, async () => {
    const { boardDefinitionFromConfig, parseBoardDefinition } =
      await import("../../../src/app/config/board-definition");
    const { sixPlayerMvpConfig } = await import("../../../src/rulesets/presets/six-player-mvp");
    const root = await createTestTempDirectory("awa-hidden-policy-record-");
    const output = await createTestTempDirectory("awa-hidden-policy-replay-");
    const roles = [
      Role.HiddenWolf,
      Role.Wolf,
      Role.Seer,
      Role.Knight,
      Role.Villager,
      Role.Villager,
    ];
    const config = {
      ...sixPlayerMvpConfig,
      hiddenWolf: { campInspection },
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((item) => item === role).length,
      })),
    };
    const board = parseBoardDefinition(boardDefinitionFromConfig("hidden_policy", config));
    const simulated = await simulateGames(board, { seeds: ["hidden-policy"], recordRoot: root });
    const record = await readReproduction(
      path.join(simulated.games[0].recordDir, "reproduction.json"),
    );
    expect(record.metadata.normalizedBoard.hiddenWolf).toEqual({ campInspection });
    const before = JSON.stringify(record);
    const replayed = await replayReproduction(record, output);
    expect(replayed.snapshot.result).toEqual(simulated.games[0].result);
    expect(replayed.eventCount).toBe(record.events.length);
    expect(replayed.decisionCount).toBe(record.decisions.length);
    expect(JSON.stringify(record)).toBe(before);
  });
}
