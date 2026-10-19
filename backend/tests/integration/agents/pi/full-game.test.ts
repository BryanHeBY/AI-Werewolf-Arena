/**
 * 本集成测试负责用真实 Pi SDK 与本机 HTTP/SSE 完成中英六人两夜有序对局，输入是既有手写行动表及合成认证。
 * 独立字面预期核对存活／胜者、工具白名单、玩家秘密、关闭资源及关闭显示时仍保存的完整思考和回应。
 * 原生录制再按同一实际构建严格重放；不扩展旧 SDK／ACP oracle，不修改冻结夹具或调用外部模型。
 */
import { expect, spyOn, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  readReplayDocument,
  readReplayManifest,
  readReplayPlayerView,
  type ReplayPlayerView,
} from "@ai-werewolf-arena/replay-contract";
import { Camp, Phase, Role } from "@ai-werewolf-arena/game-contract";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { parseRuntimeConfig } from "../../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../../src/app/config/resolve-game-setup";
import { runGame, type GameRunDependencies } from "../../../../src/app/game-runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { foundationTransportPlan } from "../../../support/builders/transport/foundation-plan";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];
const stageLabels = {
  wolf_discussion: ["狼人交流", "Wolf discussion"],
  wolf_vote: ["狼人刀人投票", "Wolf kill vote"],
  guard: ["守卫行动", "Guard action"],
  seer: ["预言家行动", "Seer action"],
  day_speech: ["白天发言", "Day speech"],
  voting: ["放逐投票", "Exile vote"],
  last_words: ["遗言", "Last words"],
} as const;

interface WireMessage {
  role: string;
  content?: string | Array<{ type: string; text?: string }>;
}
interface WireRequest {
  model: string;
  messages: WireMessage[];
  tools: Array<{ type: string; function: { name: string } }>;
}

function content(message: WireMessage): string {
  return typeof message.content === "string"
    ? message.content
    : (message.content ?? []).map((part) => part.text ?? "").join("\n");
}

function streamedAction(actor: number, ordinal: number, args: unknown): Response {
  const deltas = [
    { reasoning_content: `PRIVATE_THOUGHT_${actor}_${ordinal}` },
    { content: `PRIVATE_RESPONSE_${actor}_${ordinal}` },
    {
      tool_calls: [
        {
          index: 0,
          id: `actor-${actor}-turn-${ordinal}`,
          type: "function",
          function: { name: "submit_action", arguments: JSON.stringify(args) },
        },
      ],
    },
  ];
  const chunks: Array<Record<string, unknown>> = deltas.map((delta) => ({
    id: `pi-${actor}-${ordinal}`,
    object: "chat.completion.chunk",
    created: 0,
    model: `pi-seat-${actor}`,
    choices: [{ index: 0, delta, finish_reason: null as string | null }],
  }));
  chunks.push({
    id: `pi-${actor}-${ordinal}`,
    object: "chat.completion.chunk",
    created: 0,
    model: `pi-seat-${actor}`,
    choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
  });
  return new Response(
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}

/** 只核六人原板的手写秘密范围，不调用生产投影或角色规则反推预期。 */
function assertVisibleEvents(actor: number, messages: WireMessage[]): void {
  for (const message of messages.filter((entry) => entry.role === "user"))
    for (const line of content(message).split("\n")) {
      if (!line.startsWith('{"events":')) continue;
      const batch = JSON.parse(line) as {
        events: Array<[number, string, Record<string, unknown>]>;
      };
      for (const [, type, payload] of batch.events) {
        expect(type).not.toBe("god_private_game_info");
        expect(type).not.toBe("night_action_applied");
        if (type === "seer_checked") {
          expect(actor).toBe(2);
          expect(payload.actorId).toBe(2);
        }
        if (type === "guard_applied") expect(actor).toBe(5);
        if (["wolf_discussion", "wolf_discussion_ended", "wolf_kill_vote_cast"].includes(type))
          expect([1, 4]).toContain(actor);
      }
    }
}

function roundMessages(view: ReplayPlayerView) {
  return view.timeline.flatMap((entry) => (entry.kind === "turn" ? entry.delta_messages : []));
}

for (const locale of ["zh-CN", "en"] as const)
  test(`Pi ${locale}: real HTTP/SSE six-player game records private blocks with display off and strictly replays`, async () => {
    const output = await createTestTempDirectory("awa-pi-full-game-"),
      replayOutput = await createTestTempDirectory("awa-pi-full-replay-"),
      plan = foundationTransportPlan(6),
      counts = new Map<number, number>(),
      failures: string[] = [],
      terminal: Parameters<NonNullable<GameRunDependencies["onRuntimeClosed"]>>[0][] = [],
      lines: string[] = [];
    const secret = "pi-local-synthetic-only";
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        requests++;
        try {
          expect(request.headers.get("authorization")).toBe(`Bearer ${secret}`);
          const body = (await request.json()) as WireRequest,
            actor = Number(/^pi-seat-(\d+)$/.exec(body.model)?.[1]),
            ordinal = (counts.get(actor) ?? 0) + 1,
            expected = plan.get(actor)?.[ordinal - 1];
          if (!expected?.action)
            throw new Error(`pi_fixture_unexpected_request:${actor}:${ordinal}`);
          expect(body.tools.map((tool) => tool.function.name).sort()).toEqual([
            "get_game_schema",
            "report_bug",
            "submit_action",
          ]);
          const prompt = [...body.messages]
            .reverse()
            .find((message) => message.role === "user" && content(message).includes("["));
          if (!prompt) throw new Error("pi_fixture_action_prompt_missing");
          const current = content(prompt),
            turnId = /turn_id (?:必须为|must be) (p\d+)/.exec(current)?.[1];
          if (!turnId) throw new Error("pi_fixture_turn_missing");
          expect(current).toContain(
            locale === "en" ? `[Action prompt] Player ${actor},` : `[行动提示] ${actor}号玩家`,
          );
          expect(current).toContain(
            locale === "en"
              ? `Current game day: ${expected.day}.`
              : `当前日次：第${expected.day}天。`,
          );
          const label = stageLabels[expected.stage as keyof typeof stageLabels];
          if (!label) throw new Error("pi_fixture_unexpected_stage");
          expect(current).toContain(
            locale === "en" ? `stage: ${label[1]};` : `子阶段是${label[0]}，`,
          );
          const whole = JSON.stringify(body.messages);
          expect(whole).toContain(`PRIVATE_PERSONA_${actor}`);
          expect(whole).toContain("PI_GLOBAL_INSTRUCTIONS");
          for (const other of [1, 2, 3, 4, 5, 6].filter((id) => id !== actor)) {
            expect(whole).not.toContain(`PRIVATE_PERSONA_${other}`);
            expect(whole).not.toContain(`PRIVATE_THOUGHT_${other}_`);
            expect(whole).not.toContain(`PRIVATE_RESPONSE_${other}_`);
          }
          assertVisibleEvents(actor, body.messages);
          counts.set(actor, ordinal);
          return streamedAction(actor, ordinal, {
            turn_id: turnId,
            action: expected.action.name,
            arguments: expected.action.args,
          });
        } catch (error) {
          failures.push(error instanceof Error ? error.message : "pi_fixture_failed");
          return Response.json(
            { error: { message: "pi_fixture_protocol_failure" } },
            { status: 400 },
          );
        }
      },
    });
    const logs = spyOn(console, "log").mockImplementation((...values) =>
      lines.push(values.join(" ")),
    );
    try {
      const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
        "six_player_mvp",
      );
      const runtime = parseRuntimeConfig({
        backends: {
          schemaVersion: 2,
          items: {
            local: {
              kind: "pi",
              config: {
                models: {
                  providers: {
                    "awa-pi-local": {
                      baseUrl: `${server.url.origin}/v1`,
                      api: "openai-completions",
                      authHeader: true,
                      models: Array.from({ length: 6 }, (_, i) => ({
                        id: `pi-seat-${i + 1}`,
                        reasoning: true,
                        compat: { supportsReasoningEffort: false },
                      })),
                    },
                  },
                },
                auth: { "awa-pi-local": { type: "api_key", key: secret } },
              },
              limits: { maxConcurrentRequests: 2 },
            },
          },
        },
        agents: {
          schemaVersion: 2,
          default: "seat-1",
          items: Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [
              `seat-${i + 1}`,
              {
                backend: "local",
                options: {
                  defaultProvider: "awa-pi-local",
                  defaultModel: `pi-seat-${i + 1}`,
                  defaultThinkingLevel: "medium",
                  compaction: { enabled: false },
                  retry: { enabled: false, provider: { maxRetries: 0 } },
                },
                customInstructions: { mode: "replace", text: `PRIVATE_PERSONA_${i + 1}` },
              },
            ]),
          ),
        },
        game: {
          board: "six_player_mvp",
          customInstructions: { text: "PI_GLOBAL_INSTRUCTIONS" },
          locale,
          seed: "foundation-six:116",
          players: Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [
              String(i + 1),
              { name: `Seat ${i + 1}`, agent: `seat-${i + 1}` },
            ]),
          ),
        },
        debugSummary: { agent: { enabled: false } },
        environment: {},
      });
      const result = await runGame(
        resolveGameSetup(
          runtime,
          {
            recordRootDir: output,
            maxDays: 4,
            maxRuntimeMs: 60000,
            llmTimeoutMs: 5000,
            streamEvents: false,
            trace: false,
            printThinking: false,
            printLlmIo: false,
            printPrivateEvents: false,
            color: false,
          },
          board,
        ),
        { onRuntimeClosed: (state) => terminal.push(state) },
      );
      expect(failures).toEqual([]);
      expect(result.snapshot).toMatchObject({ day: 2, phase: Phase.GameOver, gameOver: true });
      expect(result.snapshot.result).toMatchObject({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        outcome: { winningPlayerIds: [2, 3, 5, 6] },
      });
      expect([...counts].sort(([a], [b]) => a - b)).toEqual(
        [...plan].map(([actor, turns]) => [actor, turns.length]),
      );
      expect(lines.join("\n")).not.toContain("PRIVATE_THOUGHT_");
      expect(lines.join("\n")).not.toContain("PRIVATE_RESPONSE_");
      expect(lines.join("\n")).not.toContain("PRIVATE_PERSONA_");
      expect(terminal).toEqual([
        {
          closed: true,
          pi: [
            {
              closed: true,
              turns: 0,
              sessions: 0,
              creating: 0,
              scheduler: { closed: true, active: 0, queued: 0 },
            },
          ],
        },
      ]);
      const directory = path.join(
        output,
        (await readdir(output)).find((name) => name.startsWith("session_"))!,
      );
      const manifest = readReplayManifest(
        JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")),
      );
      expect(manifest.players.map((player) => player.role)).toEqual(roles);
      expect(
        manifest.players.filter((player) => player.alive).map((player) => player.player_id),
      ).toEqual([2, 6]);
      const record = await readReproduction(path.join(directory, "reproduction.json"));
      expect(record.finalized).toBe(true);
      expect(record.metadata.players.map((player) => player.agent?.kind)).toEqual(
        Array(6).fill("pi"),
      );
      expect(record.operations.filter((operation) => operation.status !== "ok")).toEqual([]);
      for (const [actor, turns] of plan) {
        const decisions = record.decisions.filter((decision) => decision.actorId === actor);
        expect(
          decisions.map((decision) => ({
            day: decision.day,
            stage: decision.stage,
            outcome: decision.outcome,
          })),
        ).toEqual(
          turns.map((turn) => ({
            day: turn.day,
            stage: turn.stage,
            outcome: { kind: "action", action: turn.action },
          })),
        );
        const view = readReplayPlayerView(
          JSON.parse(await readFile(path.join(directory, `players/player_${actor}.json`), "utf8")),
        );
        expect(view.locale).toBe(locale);
        const messages = roundMessages(view);
        expect(messages.filter((message) => message.kind === "prompt")).toHaveLength(turns.length);
        expect(
          messages
            .filter((message) => message.name === "thinking")
            .map((message) => message.content),
        ).toEqual(turns.map((_, i) => `PRIVATE_THOUGHT_${actor}_${i + 1}`));
        expect(
          messages
            .filter((message) => message.name === "message")
            .map((message) => message.content),
        ).toEqual(turns.map((_, i) => `PRIVATE_RESPONSE_${actor}_${i + 1}`));
        expect(
          messages.filter((message) => message.kind === "tool_call" && message.accepted),
        ).toHaveLength(turns.length);
        for (const other of [1, 2, 3, 4, 5, 6].filter((id) => id !== actor)) {
          expect(JSON.stringify(view)).not.toContain(`PRIVATE_PERSONA_${other}`);
          expect(JSON.stringify(view)).not.toContain(`PRIVATE_THOUGHT_${other}_`);
          expect(JSON.stringify(view)).not.toContain(`PRIVATE_RESPONSE_${other}_`);
        }
      }
      const replay = readReplayDocument(
        JSON.parse(await readFile(path.join(directory, "replay.json"), "utf8")),
      );
      expect<unknown>(replay.result.decision).toEqual(result.snapshot.result);
      expect(
        replay.events
          .filter((event) => event.type === "night_resolved")
          .map((event) => event.payload.deaths),
      ).toEqual([[3], [5]]);
      expect(JSON.stringify(replay)).not.toContain("PRIVATE_THOUGHT_");
      expect(JSON.stringify(replay)).not.toContain("PRIVATE_RESPONSE_");
      const before = [...counts],
        beforeRequests = requests;
      const restored = await replayReproduction(record, replayOutput);
      expect(restored.snapshot).toEqual(result.snapshot);
      expect(restored.decisionCount).toBe(
        [...plan.values()].reduce((sum, turns) => sum + turns.length, 0),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect([...counts]).toEqual(before);
      expect(requests).toBe(beforeRequests);
      expect(failures).toEqual([]);
    } finally {
      logs.mockRestore();
      server.stop(true);
    }
  }, 60000);
