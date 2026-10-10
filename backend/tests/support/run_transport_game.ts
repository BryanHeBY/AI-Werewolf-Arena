const transportDiagnostic = (...values: unknown[]) => {
  process.stderr.write(
    values.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ") + "\n",
  );
};
import { expect } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertReplayDocument, assertReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import type { ResolvedBoardDefinition } from "../../src/runtime/config/board_definition";
import { runGame } from "../../src/runtime/game_runner";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "./temp_directory";
import type { ActorTransportPlan, PlannedTurn } from "./foundation_transport_plan";
import {
  assertTransportPrompt,
  assertTransportEvents,
  assertTransportIdentity,
} from "./transport_prompt_oracle";
import type { Role } from "../../src/core";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { ReplayManifest, ReplayPlayerView } from "../../src/recording/contracts";

export interface TransportGameScenario {
  expectedFailure?: { actorId: number; stage: string };
  board: ResolvedBoardDefinition;
  seed: string;
  eventRoles?: readonly Role[];
  roles: readonly Role[];
  turns: ReadonlyMap<number, PlannedTurn[]>;
  promptAssertions?: (
    actor: number,
    locale: "zh-CN" | "en",
  ) => Pick<
    ActorTransportPlan,
    | "expectedIdentityMarker"
    | "expectedTeammateIds"
    | "requiredCurrentMarkers"
    | "forbiddenCurrentMarkers"
  >;
}

/** Real runner/factory/SDK/ACP/MCP; only model decisions come from literal actor scripts. */
export async function runTransportGame(
  scenario: TransportGameScenario,
  kind: "llm" | "acp" | "mixed",
  locale: "zh-CN" | "en",
) {
  const root = await createTestTempDirectory("awa-role-transport-"),
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
    sdkPrompts = new Map<number, string[]>(),
    acpTraces: Array<{ actor: number; trace: any }> = [];
  const server =
    kind !== "acp"
      ? Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(request) {
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
              if (!turn) throw new Error("fixture_extra_turn");
              const prompt = [...body.messages]
                .reverse()
                .find(
                  (message: any) =>
                    message.role === "user" &&
                    typeof message.content === "string" &&
                    /(?:\[Action prompt\]|\[行动提示\])/.test(message.content),
                )?.content;
              const turnId = assertTransportPrompt(plan, turn, prompt);
              const history = sdkPrompts.get(actor) ?? [];
              history.push(prompt);
              sdkPrompts.set(actor, history);
              if (locale === "en")
                expect(JSON.stringify(body.messages)).not.toMatch(/\p{Script=Han}/u);
              expect(body.messages[0].content).toContain(
                locale === "en" ? "Use English" : "你必须使用中文",
              );
              expect(body.messages[0].content).toContain(plan.expectedName!);
              assertTransportIdentity(plan, body.messages[0].content);
              if (plan.expectedIdentityMarker)
                expect(body.messages[0].content).toContain(plan.expectedIdentityMarker);
              for (const message of body.messages)
                if (
                  typeof message.content === "string" &&
                  message.content.startsWith('{"event":')
                ) {
                  assertTransportEvents(
                    plan.eventRole ?? plan.role,
                    [JSON.parse(message.content).event],
                    actor,
                  );
                }
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
              if (turn.terminalFailure === "late")
                await new Promise((resolve) => setTimeout(resolve, 1500));
              return Response.json({
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
              });
            } catch (error) {
              failures.push(String(error));
              transportDiagnostic("[fixture_protocol_failure]", String(error));
              return Response.json(
                { error: { message: "fixture_protocol_failure" } },
                { status: 400 },
              );
            }
          },
        })
      : undefined;
  try {
    const providers: Record<string, unknown> = {},
      agents: Record<string, unknown> = {},
      players: Record<string, unknown> = {};
    providers.sdk = {
      type: "openai",
      apiKey: "synthetic-only",
      baseURL: `${server?.url.origin ?? "http://127.0.0.1"}/v1`,
      maxConcurrentRequests: 2,
    };
    providers.acp = {
      type: "acp",
      transport: "stdio",
      command: process.execPath,
      args: [path.resolve(process.cwd(), "tests/fixtures/acp_game_agent.ts")],
      maxConcurrentRequests: 2,
    };
    for (const [actor, plan] of plans) {
      const id = `actor-${actor}`;
      players[String(actor)] = { name: plan.expectedName, agent: id };
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
          llmTimeoutMs: scenario.expectedFailure ? 1000 : 10000,
          streamEvents: false,
          printThinking: false,
          color: false,
        },
        scenario.board,
      ),
    ).catch(async (error) => {
      if (!scenario.expectedFailure) {
        try {
          const name = (await fs.readdir(root)).find((name) => name.startsWith("session_"));
          if (name) {
            const prefix = JSON.parse(
              await fs.readFile(path.join(root, name, "reproduction.json"), "utf8"),
            );
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
    expect(failureThrown).toBe(Boolean(scenario.expectedFailure));
    expect(failures).toEqual([]);
    const session = (await fs.readdir(root)).find((name) => name.startsWith("session_"))!,
      directory = path.join(root, session);
    const replay: ReplayDocument = JSON.parse(
      await fs.readFile(path.join(directory, "replay.json"), "utf8"),
    );
    assertReplayDocument(replay);
    const manifest: ReplayManifest = JSON.parse(
      await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
    );
    expect(replay.players.map((player) => player.role)).toEqual([...scenario.roles]);
    expect(manifest.game_result).toEqual(result.snapshot.result ?? undefined);
    expect(replay.result.decision).toEqual(result.snapshot.result ?? undefined);
    const views: ReplayPlayerView[] = [];
    if (scenario.expectedFailure) {
      for (const actor of plans.keys()) {
        const view: ReplayPlayerView = JSON.parse(
          await fs.readFile(path.join(directory, `players/player_${actor}.json`), "utf8"),
        );
        assertReplayPlayerView(view);
        views.push(view);
        for (const row of view.timeline)
          if (row.kind === "turn")
            expect(row.delta_messages.some((m) => m.kind === "fallback")).toBe(false);
      }
      const record = await readReproduction(path.join(directory, "reproduction.json"));
      expect(record.checkpoints.at(-1)!.complete).toBe(false);
      expect(
        record.decisions.some(
          (d) =>
            d.actorId === scenario.expectedFailure!.actorId &&
            d.stage === scenario.expectedFailure!.stage &&
            d.day === record.checkpoints.at(-1)!.snapshot.day &&
            d.outcome.kind === "error",
        ),
      ).toBe(true);
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
        const trace = JSON.parse(
          await fs.readFile(
            path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`),
            "utf8",
          ),
        );
        acpTraces.push({ actor, trace });
        expect(trace.failure).toBe("");
        expect(trace.schemaChecked && trace.initializationSeen).toBe(true);
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
      }
      return {
        result,
        record,
        replay,
        manifest,
        views,
        sdkPrompts,
        acpTraces,
        rejected,
        directory,
      };
    }
    for (const [actor, plan] of plans) {
      const view: ReplayPlayerView = JSON.parse(
        await fs.readFile(path.join(directory, `players/player_${actor}.json`), "utf8"),
      );
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
      assertTransportEvents(plan.eventRole ?? plan.role, events, actor);
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
        const trace = JSON.parse(
          await fs.readFile(
            path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`),
            "utf8",
          ),
        );
        acpTraces.push({ actor, trace });
        expect(trace.failure).toBe("");
        expect(trace.consumed).toBe(plan.turns.length);
        expect(trace.locale).toBe(locale);
        expect(trace.schemaChecked).toBe(true);
        expect(trace.initializationSeen).toBe(true);
        expect(trace.rejected).toBe(
          plan.turns.reduce((sum, turn) => sum + (turn.invalidActions?.length ?? 0), 0),
        );
        for (const pid of [trace.agentPid, trace.mcpPid]) {
          expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
          try {
            process.kill(pid, 0);
            throw new Error("fixture_process_alive");
          } catch (error) {
            expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
          }
        }
      }
    }
    const record = await readReproduction(path.join(directory, "reproduction.json"));
    for (const [actor, plan] of plans)
      expect(
        record.decisions
          .filter((decision) => decision.actorId === actor)
          .map((decision) => ({
            day: decision.day,
            stage: decision.stage,
            outcome: decision.outcome,
          })),
      ).toEqual(
        plan.turns.map((turn) => ({
          day: turn.day,
          stage: turn.stage,
          outcome: { kind: "action", action: turn.action },
        })),
      );
    const reproduction = await replayReproduction(
      record,
      await createTestTempDirectory("awa-role-replayed-"),
    );
    expect(reproduction.snapshot).toEqual(result.snapshot);
    return { result, record, replay, manifest, views, sdkPrompts, acpTraces, rejected, directory };
  } finally {
    server?.stop(true);
  }
}
