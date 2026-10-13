/**
 * 负责共享传输测试驱动的受控执行与录制支持；输入为字面行动计划、原 fixture 句柄与本地传输。
 * 输出保留原驱动回调、轨迹、缓存和清理；新封装只在实际磁盘入口解包，预期由既有手写 oracle 持有。
 * 原传输／复盘／脚本行动生命周期不变，不引入计费模型或生产状态写入器。
 */
import { readReplayManifest, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
import { assertSdkTransportEnvelope, assertRuntimeClosure, assertArchiveDecisionEnvelope, assertFailedCheckpoint, assertFailedAcpTrace, assertFailureTiming, assertCompletedAcpTrace, assertPlannedDecisionTape } from "../../oracles/transport/outcomes";
import type { TransportGameScenario } from "../../transport/contracts";
import { acpAdapterEntry } from "../../fixtures/manifest";
import { expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertControlOwnerClosed } from "./control-owner";
import { authenticatedSyntheticModelFetch } from "../agents/synthetic-model-fetch";
import { syntheticModelToken } from "../agents/synthetic-model-fetch";
import { assertReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { assertReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { parseRuntimeConfig } from "../../../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../../../src/runtime/config/resolve_game_setup";
import { runGame } from "../../../../src/runtime/game_runner";
import type { GameRunDependencies } from "../../../../src/runtime/game_runner";
import { readReproduction } from "../../../../src/runtime/simulation/replay_reproduction";
import { replayReproduction } from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../temp-directories";
import type { ActorTransportPlan } from "../../transport/contracts";
import { assertSubmitActionWireSchema } from "../../features/mist-raven/oracles/transport";
import type { MistWireState } from "../../features/mist-raven/oracles/transport";
import { assertTransportPrompt } from "../../oracles/transport/observations";
import { assertTransportEvents } from "../../oracles/transport/observations";
import { assertTransportIdentity } from "../../oracles/transport/observations";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { ReplayManifest } from "../../../../src/recording/contracts";
import type { ReplayPlayerView } from "../../../../src/recording/contracts";

const transportDiagnostic = (...values: unknown[]) => {
  process.stderr.write(
    values.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ") + "\n",
  );
};

export async function runTransportGame(
  scenario: TransportGameScenario,
  kind: "llm" | "acp" | "mixed",
  locale: "zh-CN" | "en",
) {
  const root = await createTestTempDirectory("awa-role-transport-"),
    sdkToken = syntheticModelToken(),
    plans = new Map<number, ActorTransportPlan>();
  for (const [actorId, turns] of scenario.turns)
    plans.set(actorId, {
      actorId,
      role: scenario.roles[actorId - 1],
      eventRole: scenario.eventRoles?.[actorId - 1],
      locale,
      turns,
      expectedName: `Seat ${actorId}`,
      ...scenario.promptAssertions?.(actorId, locale),
    });
  const transportKind = (actor: number) => (kind === "mixed" ? (actor % 2 ? "llm" : "acp") : kind);
  const counts = new Map<number, number>(),
    attempts = new Map<number, number>(),
    rejected = new Map<number, number>();
  const failures: string[] = [],
    wireStates = new Map<number, MistWireState>(),
    sdkPrompts = new Map<number, string[]>(),
    sdkWireMessages: Array<{ actor: number; ordinal: number; messages: unknown[] }> = [],
    acpTraces: Array<{ actor: number; trace: any }> = [];
  const deadlines: Array<
    Parameters<NonNullable<GameRunDependencies["selectRequestDeadline"]>>[0] & {
      deadlineAtMs: number;
    }
  > = [];
  const arrivals: Array<{
    actorId: number;
    day: number;
    stage: string;
    actorOrdinal: number;
    turnId: string;
    arrivedAtMs: number;
    terminalFailure?: string;
  }> = [];
  const delayedResponses: Array<{
    actorId: number;
    actorOrdinal: number;
    completed: boolean;
    cancelledBy?: "client" | "fixture_cleanup";
  }> = [];
  const pendingDelays = new Set<() => void>();
  let cleanupStarted = false;
  let closedState: Parameters<NonNullable<GameRunDependencies["onRuntimeClosed"]>>[0] | undefined;
  const failedPlan = scenario.expectedFailure && plans.get(scenario.expectedFailure.actorId)!;
  const failedIndex = failedPlan
    ? failedPlan.turns.findIndex(
        (t) => t.stage === scenario.expectedFailure!.stage && t.terminalFailure !== undefined,
      )
    : -1;
  if (scenario.expectedFailure && failedIndex < 0)
    throw new Error("fixture_failure_target_missing");
  const failureTarget = failedPlan && {
    actorId: failedPlan.actorId,
    actorOrdinal: failedIndex + 1,
    day: failedPlan.turns[failedIndex]!.day,
    stage: failedPlan.turns[failedIndex]!.stage,
    mode: failedPlan.turns[failedIndex]!.terminalFailure,
  };
  const diagnostics = {
    deadlines,
    arrivals,
    delayedResponses,
    pendingDelays: 0,
    closedState: undefined as typeof closedState,
  };
  const server =
    kind !== "acp"
      ? Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch: authenticatedSyntheticModelFetch(sdkToken, async (request) => {
            try {
              const body = (await request.json()) as any;
              const actor = Number(/^synthetic-player-(\d+)$/.exec(body.model)?.[1]);
              if (transportKind(actor) !== "llm") throw new Error("fixture_wrong_transport");
              const plan = plans.get(actor)!,
                index = Math.min(
                  counts.get(actor) ?? 0,
                  scenario.expectedFailure?.actorId === actor
                    ? plan.turns.length - 1
                    : Number.MAX_SAFE_INTEGER,
                ),
                turn = plan.turns[index];
              if (!wireStates.has(actor)) wireStates.set(actor, {});
              if (!turn) throw new Error("fixture_extra_turn");
              if (plan.mistWire || plan.verifyGameWire)
                assertSubmitActionWireSchema(
                  body.tools?.find((t: any) => t.function?.name === "submit_action")?.function
                    .parameters,
                );
              wireStates.get(actor)!.currentDay = turn.day;
              wireStates.get(actor)!.currentRequestOrdinal = index + 1;
              const prompt = [...body.messages]
                .reverse()
                .find(
                  (message: any) =>
                    message.role === "user" &&
                    typeof message.content === "string" &&
                    /(?:\[Action prompt\]|\[行动提示\])/.test(message.content),
                )?.content;
              const turnId = assertTransportPrompt(plan, turn, prompt);
              arrivals.push({
                actorId: actor,
                day: turn.day,
                stage: turn.stage,
                actorOrdinal: index + 1,
                turnId,
                arrivedAtMs: Date.now(),
                terminalFailure: turn.terminalFailure,
              });
              if (
                scenario.board.config.radiantEclipse ||
                scenario.board.config.nobleSecretBody ||
                scenario.board.config.fragrantPairSeer ||
                scenario.board.config.animalDream
              )
                sdkWireMessages.push({
                  actor,
                  ordinal: index + 1,
                  messages: structuredClone(body.messages),
                });
              const history = sdkPrompts.get(actor) ?? [];
              history.push(prompt);
              sdkPrompts.set(actor, history);
              assertSdkTransportEnvelope(locale, plan, body, actor, wireStates);
              const attempt = attempts.get(actor) ?? 0,
                invalid = turn.invalidActions?.[attempt];
              const action = invalid ?? turn.action;
              if (invalid) {
                attempts.set(actor, attempt + 1);
                rejected.set(actor, (rejected.get(actor) ?? 0) + 1);
              } else {
                if (turn.invalidActions?.length)
                  expect(JSON.stringify(body.messages)).toContain(
                    turn.expectedInvalidError ?? "shoot_target",
                  );
                counts.set(actor, index + 1);
                attempts.delete(actor);
              }
              const response = {
                id: "synthetic-role-game",
                object: "chat.completion",
                created: 1,
                model: "synthetic",
                choices: [
                  {
                    index: 0,
                    finish_reason: action ? "tool_calls" : "stop",
                    message: {
                      role: "assistant",
                      content: action ? null : "No action",
                      ...(action
                        ? {
                            tool_calls: [
                              {
                                id: `c-${actor}-${index}-${attempt}`,
                                type: "function",
                                function: {
                                  name: "submit_action",
                                  arguments: JSON.stringify({
                                    turn_id: turnId,
                                    action: action.name,
                                    arguments: action.args,
                                  }),
                                },
                              },
                            ],
                          }
                        : {}),
                    },
                  },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
              };
              const delayMs = turn.terminalFailure === "late" ? 2200 : turn.responseDelayMs;
              if (!delayMs) return Response.json(response);
              const observation = {
                actorId: actor,
                actorOrdinal: index + 1,
                completed: false,
              } as (typeof delayedResponses)[number];
              delayedResponses.push(observation);
              let timer: ReturnType<typeof setTimeout>;
              const cancel = () => {
                clearTimeout(timer);
                observation.cancelledBy = cleanupStarted ? "fixture_cleanup" : "client";
                pendingDelays.delete(cancel);
              };
              return new Response(
                new ReadableStream<Uint8Array>({
                  start(controller) {
                    const json = JSON.stringify(response),
                      encoder = new TextEncoder();
                    controller.enqueue(encoder.encode(json.slice(0, 1)));
                    pendingDelays.add(cancel);
                    timer = setTimeout(() => {
                      pendingDelays.delete(cancel);
                      observation.completed = true;
                      controller.enqueue(encoder.encode(json.slice(1)));
                      controller.close();
                    }, delayMs);
                  },
                  cancel,
                }),
                { headers: { "content-type": "application/json" } },
              );
            } catch (error) {
              failures.push(String(error));
              transportDiagnostic("[fixture_protocol_failure]", String(error));
              return Response.json(
                { error: { message: "fixture_protocol_failure" } },
                { status: 400 },
              );
            }
          }),
        })
      : undefined;
  try {
    const providers: Record<string, unknown> = {},
      agents: Record<string, unknown> = {},
      players: Record<string, unknown> = {};
    providers.sdk = {
      type: "openai",
      apiKey: sdkToken,
      baseURL: `${server?.url.origin ?? "http://127.0.0.1"}/v1`,
      maxConcurrentRequests: 2,
    };
    providers.acp = {
      type: "acp",
      transport: "stdio",
      command: process.execPath,
      args: [acpAdapterEntry("game")],
      maxConcurrentRequests: 2,
    };
    for (const [actor, plan] of plans) {
      const id = `actor-${actor}`;
      players[String(actor)] = {
        name: plan.expectedName,
        agent: id,
        ...(scenario.board.config.radiantEclipse && [4, 7, 8, 9].includes(actor)
          ? { personalityPrompt: `SOURCE_HISTORY_PRIVATE_ACTOR_${actor}` }
          : {}),
        ...(scenario.board.config.nobleSecretBody
          ? { personalityPrompt: `NOBLE_PRIVATE_ACTOR_${actor}` }
          : {}),
      };
      if (transportKind(actor) === "llm")
        agents[id] = { kind: "llm", provider: "sdk", model: `synthetic-player-${actor}` };
      else {
        const script = path.join(root, `actor-${actor}.json`);
        await fs.writeFile(script, JSON.stringify(plan));
        agents[id] = { kind: "acp", provider: "acp", spawnArgs: [script] };
      }
    }
    const runtime = parseRuntimeConfig({
      providers: { default: "sdk", items: providers },
      agents: { default: "actor-1", items: agents },
      game: {
        board: scenario.board.definition.id,
        locale,
        displayLocale: locale === "en" ? "zh-CN" : "en",
        seed: scenario.seed,
        players,
      },
      debugSummary: { agent: { enabled: false } },
    });
    let failureThrown = false;
    const result = await runGame(
      resolveGameSetup(
        runtime,
        {
          recordRootDir: root,
          maxDays: 8,
          maxRuntimeMs: 120000,
          llmTimeoutMs: 10000,
          streamEvents: false,
          printThinking: false,
          color: false,
        },
        scenario.board,
      ),
      {
        selectRequestDeadline(request) {
          const targeted =
            failureTarget?.mode === "late" &&
            request.actorId === failureTarget.actorId &&
            request.day === failureTarget.day &&
            request.stage === failureTarget.stage &&
            request.actorOrdinal === failureTarget.actorOrdinal;
          const deadlineAtMs = request.nowMs + (targeted ? 1000 : 10000);
          deadlines.push({ ...request, deadlineAtMs });
          return deadlineAtMs;
        },
        onRuntimeClosed(state) {
          closedState = state;
          diagnostics.closedState = state;
        },
      },
    ).catch(async (error) => {
      if (!scenario.expectedFailure) {
        try {
          const name = (await fs.readdir(root)).find((name) => name.startsWith("session_"));
          if (name) {
            const prefix = parseReproductionRecord(JSON.parse(
              await fs.readFile(path.join(root, name, "reproduction.json"), "utf8"),
            ));
            transportDiagnostic(
              "[transport_failure_prefix]",
              JSON.stringify({
                decisions: prefix.decisions
                  .slice(-8)
                  .map((d: { actorId: number; day: number; stage: string; outcome: unknown }) => ({
                    actorId: d.actorId,
                    day: d.day,
                    stage: d.stage,
                    outcome: d.outcome,
                  })),
                lastCheckpoint: prefix.checkpoints.at(-1)?.failure,
              }),
            );
            if (scenario.board.config.animalDream) {
              for (const actor of plans.keys()) {
                if (transportKind(actor) !== "acp") continue;
                const trace = await fs
                  .readFile(
                    path.join(root, name, `acp-workspaces/player-${actor}/game-fixture.json`),
                    "utf8",
                  )
                  .then((value) => JSON.parse(value))
                  .catch(() => null);
                if (trace?.failure)
                  transportDiagnostic("[animal_fixture_failure]", {
                    actor,
                    failure: trace.failure,
                  });
              }
            }
          }
        } catch (diagnosticError) {
          transportDiagnostic("[transport_failure_diagnostic]", String(diagnosticError));
        }
        throw error;
      }
      failureThrown = true;
      const session = (await fs.readdir(root)).find((name) => name.startsWith("session_"))!;
      const prefix = await readReproduction(path.join(root, session, "reproduction.json"));
      return { snapshot: prefix.checkpoints.at(-1)!.snapshot, eventCount: prefix.events.length };
    });
    assertRuntimeClosure(scenario, failureThrown, closedState, failures);
    const session = (await fs.readdir(root)).find((name) => name.startsWith("session_"))!,
      directory = path.join(root, session);
    const replay: ReplayDocument = readReplayDocument(JSON.parse(
      await fs.readFile(path.join(directory, "replay.json"), "utf8"),
    ));
    assertReplayDocument(replay);
    const manifest: ReplayManifest = readReplayManifest(JSON.parse(
      await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
    )) as ReplayManifest;
    assertArchiveDecisionEnvelope(scenario, replay, manifest, result);
    const views: ReplayPlayerView[] = [];
    if (scenario.expectedFailure) {
      const record = await readReproduction(path.join(directory, "reproduction.json"));
      for (const actor of plans.keys()) {
        const view: ReplayPlayerView = readReplayPlayerView(JSON.parse(
          await fs.readFile(path.join(directory, `players/player_${actor}.json`), "utf8"),
        ));
        assertReplayPlayerView(view);
        views.push(view);
        const events = view.timeline.flatMap((row) =>
          row.kind === "event"
            ? [
                [row.seq, row.event.type, row.event.payload] as [
                  number,
                  string,
                  Record<string, unknown>,
                ],
              ]
            : [],
        );
        const decisions = record.decisions.filter((d) => d.actorId === actor);
        const plan = plans.get(actor)!;
        assertTransportEvents(plan.eventRole ?? plan.role, events, actor, plan.mistWire, {
          currentDay: record.checkpoints.at(-1)!.snapshot.day,
          currentRequestOrdinal:
            decisions.length + (decisions.at(-1)?.outcome.kind === "error" ? 0 : 1),
        });
        for (const row of view.timeline)
          if (row.kind === "turn")
            expect(row.delta_messages.some((m) => m.kind === "fallback")).toBe(false);
      }
      assertFailedCheckpoint(record, scenario);
      expect(
        (await replayReproduction(record, await createTestTempDirectory("awa-role-failed-replay-")))
          .snapshot,
      ).toEqual(record.checkpoints.at(-1)!.snapshot);
      for (const actor of plans.keys()) {
        if (
          transportKind(actor) !== "acp" ||
          !record.decisions.some((decision) => decision.actorId === actor)
        )
          continue;
        const { controlToken, ...trace } = JSON.parse(
          await fs.readFile(
            path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`),
            "utf8",
          ),
        );
        acpTraces.push({ actor, trace });
        assertFailedAcpTrace(trace);
        // Process-group signals are asynchronous; permit a bounded kernel-exit gap.
        for (const pid of [trace.agentPid, trace.mcpPid]) {
          let alive = true;
          for (let attempt = 0; attempt < 100 && alive; attempt++) {
            try {
              process.kill(pid, 0);
            } catch (error) {
              expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
              alive = false;
            }
            if (alive) await new Promise((resolve) => setTimeout(resolve, 10));
          }
          expect(alive).toBe(false);
        }
        trace.controlClosure = await assertControlOwnerClosed(trace.controlUrl, controlToken);
      }
      assertFailureTiming(failureTarget, record, transportKind, arrivals, acpTraces, deadlines, delayedResponses);
      return {
        diagnostics,
        result,
        record,
        replay,
        manifest,
        views,
        sdkPrompts,
        sdkWireMessages,
        acpTraces,
        rejected,
        directory,
      };
    }
    for (const [actor, plan] of plans) {
      const view: ReplayPlayerView = readReplayPlayerView(JSON.parse(
        await fs.readFile(path.join(directory, `players/player_${actor}.json`), "utf8"),
      ));
      assertReplayPlayerView(view);
      views.push(view);
      const events = view.timeline
        .filter((entry) => entry.kind === "event")
        .map((entry) =>
          entry.kind === "event"
            ? ([entry.seq, entry.event.type, entry.event.payload] as [
                number,
                string,
                Record<string, unknown>,
              ])
            : undefined,
        )
        .filter((entry) => entry !== undefined);
      assertTransportEvents(plan.eventRole ?? plan.role, events, actor, plan.mistWire, {
        currentDay: result.snapshot.day,
        currentRequestOrdinal: plan.turns.length + 1,
      });
      const rounds = view.timeline.filter((entry) => entry.kind === "turn");
      expect(
        rounds,
        JSON.stringify({
          actor,
          planned: plan.turns.map((r) => [r.day, r.stage]),
          actual: rounds.map((r) => [r.day, r.stage]),
        }),
      ).toHaveLength(plan.turns.length);
      for (const round of rounds)
        if (round.kind === "turn")
          expect(
            round.delta_messages.some(
              (message) => message.kind === "fallback" || message.kind === "request_error",
            ),
          ).toBe(false);
      if (transportKind(actor) === "llm") expect(counts.get(actor) ?? 0).toBe(plan.turns.length);
      else {
        if (plan.turns.length === 0) {
          await expect(
            fs.stat(path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`)),
          ).rejects.toMatchObject({ code: "ENOENT" });
          continue; // Lazy sessions do not start for players with no decisions.
        }
        const { controlToken, ...trace } = JSON.parse(
          await fs.readFile(
            path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`),
            "utf8",
          ),
        );
        acpTraces.push({ actor, trace });
        assertCompletedAcpTrace(trace, plan, locale);
        for (const pid of [trace.agentPid, trace.mcpPid]) {
          expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
          try {
            process.kill(pid, 0);
            throw new Error("fixture_process_alive");
          } catch (error) {
            expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
          }
        }
        trace.controlClosure = await assertControlOwnerClosed(trace.controlUrl, controlToken);
      }
    }
    const record = await readReproduction(path.join(directory, "reproduction.json"));
    assertPlannedDecisionTape(record, plans);
    const reproduction = await replayReproduction(
      record,
      await createTestTempDirectory("awa-role-replayed-"),
    );
    expect(reproduction.snapshot).toEqual(result.snapshot);
    return {
      result,
      record,
      replay,
      manifest,
      views,
      sdkPrompts,
      sdkWireMessages,
      acpTraces,
      rejected,
      directory,
      diagnostics,
    };
  } finally {
    cleanupStarted = true;
    server?.stop(true);
    for (const cancel of [...pendingDelays]) cancel();
    diagnostics.pendingDelays = pendingDelays.size;
  }
}
