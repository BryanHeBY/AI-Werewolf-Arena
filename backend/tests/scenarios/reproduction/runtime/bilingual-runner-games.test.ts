/**
 * Reproduction scenarios verify complete bilingual runner games across local SDK, ACP and mixed routes preserve outcomes and recording isolation.
 * Input: Original six/twelve-player role plans, transport routing, language, concurrent-game and self-destruct-window matrices.
 * Output and oracle: Handwritten terminal/skill assertions, private prompt checks and exact per-game reproduction retain original process cleanup; source configs and archive fixtures are unchanged.
 */
import { acpAdapterEntry } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertReplayDocument, assertReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { parseRuntimeConfig } from "../../../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../../../src/runtime/config/resolve_game_setup";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";
import { runGame } from "../../../../src/runtime/game_runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { foundationTransportPlan } from "../../../support/builders/transport/foundation-plan";
import { type ActorTransportPlan } from "../../../support/transport/contracts";
import { assertTransportPrompt, assertTransportEvents } from "../../../support/oracles/transport/observations";
import { ActionWindow, Camp, Phase, Role, WinCondition } from "../../../../src/core";

import { selfDestructTransportPlan } from "../../../support/builders/transport/self-destruct-plan";
import { parseBoardDefinition } from "../../../../src/runtime/config/board_definition";

const roles6 = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager] as const;
const roles12 = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
] as const;
const commonEvents = (events: Array<{ type: string; payload: Record<string, unknown> }>) =>
  events.map(({ type, payload }) => ({ type, payload }));

async function runFixture(
  size: 6 | 12,
  alternate: boolean,
  kind: "llm" | "acp" | "mixed",
  locale: "zh-CN" | "en",
  swap = false,
  window?: ActionWindow,
) {
  const root = await createTestTempDirectory("awa-full-transport-");
  const plans = window
      ? selfDestructTransportPlan(window)
      : foundationTransportPlan(size, alternate),
    roles = size === 6 ? roles6 : roles12;
  const actorPlans = new Map<number, ActorTransportPlan>(
    roles.map((role, index) => [
      index + 1,
      { actorId: index + 1, role, locale, turns: plans.get(index + 1)! },
    ]),
  );
  if (kind === "mixed")
    for (const [actor, plan] of actorPlans) {
      plan.expectedName = `Seat ${actor}`;
      plan.expectedPersona =
        actor === 4 ? null : actor === 3 ? "[persona:seat:3]" : `[persona:agent:${actor}]`;
      plan.forbiddenPersonas = [
        ...roles.flatMap((_, index) => [
          `[persona:agent:${index + 1}]`,
          `[persona:seat:${index + 1}]`,
        ]),
      ].filter((marker) => marker !== plan.expectedPersona);
    }
  const actorKind = (actor: number) =>
    kind === "mixed" ? (Boolean(actor % 2) !== swap ? "llm" : "acp") : kind;
  const counts = new Map<number, number>(),
    failures: string[] = [],
    visibleSeerTargets = new Map<number, Set<number>>();
  const server =
    kind !== "acp"
      ? Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(request) {
            try {
              const body = (await request.json()) as any;
              const actorId = Number(
                  /^synthetic-player-(\d+)$/.exec(body.model)?.[1] ??
                    new URL(request.url).pathname.match(/player-(\d+)/)?.[1],
                ),
                plan = actorPlans.get(actorId)!;
              if (actorKind(actorId) !== "llm") throw new Error("fixture_wrong_transport_route");
              const index = counts.get(actorId) ?? 0,
                turn = plan.turns[index];
              if (!turn) throw new Error(`fixture_extra_turn:${actorId}`);
              const prompt = body.messages.at(-1).content as string;
              const turnId = assertTransportPrompt(plan, turn, prompt);
              if (locale === "en")
                expect(JSON.stringify(body.messages)).not.toMatch(/[\u4e00-\u9fff]/);
              expect(body.messages[0].content).toContain(
                locale === "en" ? "Use English" : "你必须使用中文",
              );
              if (plan.expectedName) {
                expect(body.messages[0].content).toContain(plan.expectedName);
                if (plan.expectedPersona)
                  expect(body.messages[0].content).toContain(plan.expectedPersona);
                for (const marker of plan.forbiddenPersonas!)
                  expect(body.messages[0].content).not.toContain(marker);
              }
              for (const message of body.messages) {
                if (
                  typeof message.content === "string" &&
                  message.content.startsWith('{"event":')
                ) {
                  const event = JSON.parse(message.content).event as [
                    number,
                    string,
                    Record<string, unknown>,
                  ];
                  assertTransportEvents(plan.role, [event], actorId);
                  if (event[1] === "seer_checked") {
                    const seen = visibleSeerTargets.get(actorId) ?? new Set<number>();
                    seen.add(event[2].targetId as number);
                    visibleSeerTargets.set(actorId, seen);
                  }
                }
              }
              const toolBody = JSON.stringify(body.tools);
              if (locale === "en") expect(toolBody).not.toMatch(/[\u4e00-\u9fff]/);
              counts.set(actorId, index + 1);
              return Response.json({
                id: "synthetic-game",
                object: "chat.completion",
                created: 1,
                model: "synthetic",
                choices: [
                  {
                    index: 0,
                    finish_reason: turn.action ? "tool_calls" : "stop",
                    message: {
                      role: "assistant",
                      content: turn.action ? null : "No action",
                      ...(turn.action
                        ? {
                            tool_calls: [
                              {
                                id: `c-${actorId}-${index}`,
                                type: "function",
                                function: {
                                  name: "submit_action",
                                  arguments: JSON.stringify({
                                    turn_id: turnId,
                                    action: turn.action.name,
                                    arguments: turn.action.args,
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
    if (kind === "mixed") {
      providers["shared-sdk"] = {
        type: "openai",
        apiKey: "synthetic-auth-only",
        baseURL: `${server!.url.origin}/v1`,
        maxConcurrentRequests: 2,
      };
      providers["shared-acp"] = {
        type: "acp",
        transport: "stdio",
        command: process.execPath,
        args: [acpAdapterEntry("game")],
        maxConcurrentRequests: 2,
      };
    }
    for (const [actorId, plan] of actorPlans) {
      const id = `actor-${actorId}`;
      players[String(actorId)] = { name: `Seat ${actorId}`, agent: id };
      if (actorKind(actorId) === "llm") {
        providers[id] = {
          type: "openai",
          apiKey: "synthetic-auth-only",
          baseURL: `${server!.url.origin}/v1/player-${actorId}`,
        };
        agents[id] =
          kind === "mixed"
            ? { kind: "llm", provider: "shared-sdk", model: `synthetic-player-${actorId}` }
            : { kind: "llm", provider: id, model: "synthetic" };
      } else {
        const file = path.join(root, `script-${actorId}.json`);
        await fs.writeFile(file, JSON.stringify(plan));
        providers[id] = {
          type: "acp",
          transport: "stdio",
          command: process.execPath,
          args: [acpAdapterEntry("game")],
          env: { AWA_TEST_PLAN_FILE: file },
        };
        agents[id] =
          kind === "mixed"
            ? { kind: "acp", provider: "shared-acp", spawnArgs: [file] }
            : { kind: "acp", provider: id };
      }
    }
    if (kind === "mixed")
      for (const actor of actorPlans.keys()) {
        (agents[`actor-${actor}`] as any).personalityPrompt = `[persona:agent:${actor}]`;
        if (actor === 3)
          (players[String(actor)] as any).personalityPrompt = {
            "zh-CN": "[persona:seat:3]",
            en: "[persona:seat:3]",
          };
        if (actor === 4) (players[String(actor)] as any).personalityPrompt = null;
      }
    const boardName = size === 6 ? "six_player_mvp" : "twelve_player_standard";
    let board = await loadBoardDefinition(
      path.resolve(process.cwd(), "../configs.example"),
      boardName,
    );
    if (window) {
      const definition = structuredClone(board.definition);
      definition.rules.winConditions = [WinCondition.SlaughterCity];
      definition.rules.hooks = {
        onDaybreak: true,
        onPreElection: true,
        onPreVote: true,
        onPerSpeechGap: true,
      };
      definition.mechanisms.sheriff = {
        enabled: true,
        electionPolicy: "awa_final_candidates_v1",
        badgePolicy: "awa_next_seat_v1",
        voteWeight: 2.25,
        tieBreaker: "min_seat",
      };
      definition.mechanisms.selfDestruct.enabledWindows = [window];
      board = parseBoardDefinition(definition);
    }
    const runtime = parseRuntimeConfig({
      providers: { default: "actor-1", items: providers },
      agents: { default: "actor-1", items: agents },
      game: {
        board: boardName,
        locale,
        displayLocale: locale === "en" ? "zh-CN" : "en",
        seed: size === 6 ? "foundation-six:116" : "foundation-twelve:124680",
        players,
      },
      debugSummary: { agent: { enabled: false } },
    });
    const setup = resolveGameSetup(
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
      board,
    );
    const result = await runGame(setup);
    expect(failures).toEqual([]);
    const session = (await fs.readdir(root)).find((name) => name.startsWith("session_"))!;
    const directory = path.join(root, session);
    for (const actor of actorPlans.keys())
      if (actorKind(actor) === "acp") {
        const trace = JSON.parse(
          await fs.readFile(
            path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`),
            "utf8",
          ),
        );
        expect(trace.failure).toBe("");
      }
    expect(result.snapshot.day).toBe(size === 12 && alternate ? 3 : 2);
    expect(result.snapshot.phase).toBe(Phase.GameOver);
    expect(result.snapshot.result).toEqual({
      winner: Camp.Good,
      reason: "all_wolves_eliminated",
      outcome: {
        kind: "victory",
        primary: {
          kind: "faction",
          faction: Camp.Good,
          winningPlayerIds: size === 6 ? [2, 3, 5, 6] : [5, 6, 7, 8, 9, 10, 11, 12],
        },
        additional: [],
        winningPlayerIds: size === 6 ? [2, 3, 5, 6] : [5, 6, 7, 8, 9, 10, 11, 12],
      },
      decidedAt: {
        day: size === 12 && alternate ? 3 : 2,
        phase:
          window && window !== ActionWindow.OnPreVote && window !== ActionWindow.OnPreElection
            ? "day"
            : "voting",
        checkpoint: window
          ? window === ActionWindow.OnPreElection
            ? "exile_settled"
            : "day_interrupted"
          : size === 6
            ? "exile_settled"
            : "day_interrupted",
      },
    });
    const manifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8"));
    expect(manifest.locale).toBe(locale);
    expect(manifest.players.map((row: any) => row.role)).toEqual(roles);
    expect(manifest.players.map((row: any) => row.name)).toEqual(
      roles.map((_, index) => `Seat ${index + 1}`),
    );
    const alive =
      size === 6
        ? alternate
          ? [2, 3, 6]
          : [2, 6]
        : alternate
          ? [6, 8, 9, 10, 11, 12]
          : [5, 6, 8, 9, 10, 11, 12];
    expect(
      manifest.players.filter((row: any) => row.alive).map((row: any) => row.player_id),
    ).toEqual(alive);
    const replay = JSON.parse(await fs.readFile(path.join(directory, "replay.json"), "utf8"));
    assertReplayDocument(replay);
    expect(replay.meta.locale).toBe(locale);
    expect(replay.result.decision).toEqual(result.snapshot.result ?? undefined);
    expect(manifest.game_result).toEqual(result.snapshot.result);
    if (window) {
      expect(
        replay.events
          .filter((event: any) => event.type === "wolf_self_destruct")
          .map((event: any) => event.payload),
      ).toEqual(
        window === ActionWindow.OnPreElection
          ? [{ wolfId: 1, window }]
          : [
              { wolfId: 1, window },
              { wolfId: 4, window },
            ],
      );
      expect(
        replay.events
          .filter((event: any) => event.type === "night_resolved")
          .map((event: any) => event.payload.deaths),
      ).toEqual([[3], [5]]);
      expect(
        replay.events
          .filter((event: any) => event.type === "last_words_spoken")
          .map((event: any) => event.payload.playerId),
      ).toEqual(window === ActionWindow.OnPreElection ? [3, 4] : [3]);
      expect(
        replay.events
          .filter((event: any) => event.type === "sheriff_elected")
          .map((event: any) => event.payload.winnerId),
      ).toEqual(window === ActionWindow.OnPreElection ? [] : [2]);
    }
    const logic = JSON.parse(await fs.readFile(path.join(directory, "logic_ops.json"), "utf8"));
    expect(
      logic.ops.filter((op: any) => ["rejected", "fallback", "error"].includes(op.status)),
    ).toEqual([]);
    const views = await Promise.all(
      roles.map(async (_, index) =>
        JSON.parse(
          await fs.readFile(path.join(directory, `players/player_${index + 1}.json`), "utf8"),
        ),
      ),
    );
    for (const view of views) {
      assertReplayPlayerView(view);
      expect(view.locale).toBe(locale);
      if (window && view.player_id === 2)
        expect(
          view.timeline
            .filter((entry: any) => entry.kind === "event" && entry.event.type === "seer_checked")
            .map((entry: any) => entry.event.payload.targetId),
        ).toEqual([1, 4]);
      const rounds = view.timeline.filter((entry: any) => entry.kind === "turn");
      expect(rounds).toHaveLength(plans.get(view.player_id)!.length);
      for (const round of rounds) {
        if (round.kind !== "turn") throw new Error("fixture_round_invalid");
        expect(
          round.delta_messages.some(
            (message: any) => message.kind === "fallback" || message.kind === "request_error",
          ),
        ).toBe(false);
        const prompt = round.delta_messages.find(
          (message: any) => message.role === "user" && message.kind === "prompt",
        )?.content;
        expect(prompt).toContain(locale === "en" ? "[Action prompt]" : "[行动提示]");
      }
    }
    for (const [actor, plan] of actorPlans)
      if (actorKind(actor) === "llm") expect(counts.get(actor)).toBe(plan.turns.length);
      else {
        const trace = JSON.parse(
          await fs.readFile(
            path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`),
            "utf8",
          ),
        );
        if (plan.role === "seer")
          expect([...new Set(trace.visibleSeerTargets)]).toEqual(
            window === ActionWindow.OnDaybreak ? [1] : size === 6 ? [1, 4] : [1, 2],
          );
        expect(trace.locale).toBe(locale);
        expect(trace.initializationSeen).toBe(true);
        expect(trace.schemaChecked).toBe(true);
        expect(trace.consumed).toBe(plan.turns.length);
        for (const pid of [trace.agentPid, trace.mcpPid]) {
          expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
          try {
            process.kill(pid, 0);
            throw new Error("fixture_process_still_alive");
          } catch (error) {
            expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
          }
        }
      }
    if (actorKind(size === 6 ? 2 : 5) === "llm")
      expect([...visibleSeerTargets.get(size === 6 ? 2 : 5)!]).toEqual(
        window === ActionWindow.OnDaybreak ? [1] : size === 6 ? [1, 4] : [1, 2],
      );
    const record = await readReproduction(path.join(directory, "reproduction.json"));
    for (const [actorId, plan] of actorPlans) {
      const decisions = record.decisions.filter((decision) => decision.actorId === actorId);
      expect(decisions.map((decision) => ({ day: decision.day, stage: decision.stage }))).toEqual(
        plan.turns.map((turn) => ({ day: turn.day, stage: turn.stage })),
      );
    }
    const output = await createTestTempDirectory("awa-full-transport-replayed-");
    expect((await replayReproduction(record, output)).snapshot).toEqual(result.snapshot);
    const summary = await fs.readFile(path.join(directory, "debug_summary.md"), "utf8");
    expect(summary).toContain(locale === "en" ? "## 对局" : "## Session");
    return { result, events: commonEvents(replay.events), record, views };
  } finally {
    server?.stop(true);
  }
}

for (const size of [6, 12] as const)
  for (const alternate of [false, true])
    for (const kind of ["llm", "acp"] as const)
      test(`${size}/${alternate ? "alternate" : "standard"}/${kind}: full bilingual runner games and action replay preserve manual outcomes`, async () => {
        const zh = await runFixture(size, alternate, kind, "zh-CN");
        const en = await runFixture(size, alternate, kind, "en");
        expect(en.result).toEqual(zh.result);
        expect(en.events).toEqual(zh.events);
        expect(en.record.checkpoints.map((cp) => ({ ...cp, players: cp.players }))).toEqual(
          zh.record.checkpoints,
        );
        const neutralDecisions = (record: typeof en.record) =>
          record.decisions.map(
            ({ settleOrder: _settle, openedAfterSettlement: _opening, ...decision }) => decision,
          );
        expect(neutralDecisions(en.record)).toEqual(neutralDecisions(zh.record));
      }, 120000);

test("simultaneous SDK games keep language, records, events and complete replay scoped to each game", async () => {
  const [zh, en] = await Promise.all([
    runFixture(6, false, "llm", "zh-CN"),
    runFixture(6, false, "llm", "en"),
  ]);
  expect(zh.events).toEqual(en.events);
  expect(zh.record.metadata.locale).toBe("zh-CN");
  expect(en.record.metadata.locale).toBe("en");
  expect(zh.record.checkpoints).toEqual(en.record.checkpoints);
}, 120000);

for (const size of [6, 12] as const)
  for (const alternate of [false, true])
    for (const swap of [false, true])
      test(`${size}/${alternate ? "alternate" : "standard"}/mixed/${swap ? "even-sdk" : "odd-sdk"}: real shared-provider bilingual games preserve outcomes and exact replay`, async () => {
        const zh = await runFixture(size, alternate, "mixed", "zh-CN", swap);
        const en = await runFixture(size, alternate, "mixed", "en", swap);
        expect(en.result).toEqual(zh.result);
        expect(en.events).toEqual(zh.events);
        expect(en.record.checkpoints).toEqual(zh.record.checkpoints);
        const neutral = (record: typeof en.record) =>
          record.decisions.map(
            ({ settleOrder: _settle, openedAfterSettlement: _opening, ...decision }) => decision,
          );
        expect(neutral(en.record)).toEqual(neutral(zh.record));
      }, 120000);

for (const window of Object.values(ActionWindow))
  for (const kind of ["llm", "acp"] as const)
    test(`${window}/${kind}: real bilingual full games preserve window timing and replay`, async () => {
      const zh = await runFixture(6, false, kind, "zh-CN", false, window);
      const en = await runFixture(6, false, kind, "en", false, window);
      expect(en.result).toEqual(zh.result);
      expect(en.events).toEqual(zh.events);
      expect(en.record.checkpoints).toEqual(zh.record.checkpoints);
    }, 120000);
