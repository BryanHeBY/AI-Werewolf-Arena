import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertReplayDocument, assertReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { runGame } from "../../src/runtime/game_runner";
import { readReproduction, replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";
import { foundationTransportPlan, type ActorTransportPlan } from "../support/foundation_transport_plan";
import { assertTransportPrompt, assertTransportEvents } from "../support/transport_prompt_oracle";
import type { GameEvent } from "../../src/core";

const roles6 = ["wolf", "seer", "villager", "wolf", "guard", "villager"] as const;
const roles12 = ["wolf", "wolf", "wolf", "wolf", "seer", "witch", "hunter", "idiot", "villager", "villager", "villager", "villager"] as const;
const commonEvents = (events: GameEvent[]) => events.map(({ type, payload }) => ({ type, payload }));

async function runFixture(size: 6 | 12, alternate: boolean, kind: "llm" | "acp", locale: "zh-CN" | "en") {
  const root = await createTestTempDirectory("awa-full-transport-");
  const plans = foundationTransportPlan(size, alternate), roles = size === 6 ? roles6 : roles12;
  const actorPlans = new Map<number, ActorTransportPlan>(roles.map((role, index) => [index + 1, { actorId: index + 1, role, locale, turns: plans.get(index + 1)! }]));
  const counts = new Map<number, number>(), failures: string[] = [], visibleSeerTargets = new Map<number, Set<number>>();
  const server = kind === "llm" ? Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    try {
      const actorId = Number(new URL(request.url).pathname.match(/player-(\d+)/)?.[1]), plan = actorPlans.get(actorId)!;
      const body = await request.json() as any, index = counts.get(actorId) ?? 0, turn = plan.turns[index];
      if (!turn) throw new Error(`fixture_extra_turn:${actorId}`);
      const prompt = body.messages.at(-1).content as string;
      const turnId = assertTransportPrompt(plan, turn, prompt);
      if (locale === "en") expect(JSON.stringify(body.messages)).not.toMatch(/[\u4e00-\u9fff]/);
      expect(body.messages[0].content).toContain(locale === "en" ? "Use English" : "你必须使用中文");
      for (const message of body.messages) {
        if (typeof message.content === "string" && message.content.startsWith('{"event":')) {
          const event = JSON.parse(message.content).event as [number, string, Record<string, unknown>];
          assertTransportEvents(plan.role, [event], actorId);
          if (event[1] === "seer_checked") { const seen = visibleSeerTargets.get(actorId) ?? new Set<number>(); seen.add(event[2].targetId as number); visibleSeerTargets.set(actorId, seen); }
        }
      }
      const toolBody = JSON.stringify(body.tools); if (locale === "en") expect(toolBody).not.toMatch(/[\u4e00-\u9fff]/);
      counts.set(actorId, index + 1);
      return Response.json({ id: "synthetic-game", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: turn.action ? "tool_calls" : "stop", message: { role: "assistant", content: turn.action ? null : "No action", ...(turn.action ? { tool_calls: [{ id: `c-${actorId}-${index}`, type: "function", function: { name: "submit_action", arguments: JSON.stringify({ turn_id: turnId, action: turn.action.name, arguments: turn.action.args }) } }] } : {}) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    } catch (error) { failures.push(String(error)); return Response.json({ error: { message: "fixture_protocol_failure" } }, { status: 400 }); }
  } }) : undefined;
  try {
  const providers: Record<string, unknown> = {}, agents: Record<string, unknown> = {}, players: Record<string, unknown> = {};
  for (const [actorId, plan] of actorPlans) {
    const id = `actor-${actorId}`; players[String(actorId)] = { name: `Seat ${actorId}`, agent: id };
    if (kind === "llm") {
      providers[id] = { type: "openai", apiKey: "synthetic-auth-only", baseURL: `${server!.url.origin}/v1/player-${actorId}` };
      agents[id] = { kind, provider: id, model: "synthetic" };
    } else {
      const file = path.join(root, `script-${actorId}.json`); await fs.writeFile(file, JSON.stringify(plan));
      providers[id] = { type: "acp", transport: "stdio", command: process.execPath, args: [path.resolve(process.cwd(), "tests/fixtures/acp_game_agent.ts")], env: { AWA_TEST_PLAN_FILE: file } };
      agents[id] = { kind, provider: id };
    }
  }
  const boardName = size === 6 ? "six_player_mvp" : "twelve_player_standard";
  const board = await loadBoardDefinition(path.resolve(process.cwd(), "../configs.example"), boardName);
  const runtime = parseRuntimeConfig({ providers: { default: "actor-1", items: providers }, agents: { default: "actor-1", items: agents },
    game: { board: boardName, locale, displayLocale: locale === "en" ? "zh-CN" : "en", seed: size === 6 ? "foundation-six:116" : "foundation-twelve:124680", players },
    debugSummary: { agent: { enabled: false } },
  });
  const setup = resolveGameSetup(runtime, { recordRootDir: root, maxDays: 8, maxRuntimeMs: 120000, llmTimeoutMs: 10000, streamEvents: false, printThinking: false, color: false }, board);
    const result = await runGame(setup); expect(failures).toEqual([]);
    const session = (await fs.readdir(root)).find(name => name.startsWith("session_"))!;
    const directory = path.join(root, session);
    if (kind === "acp") for (const actor of actorPlans.keys()) {
      const trace = JSON.parse(await fs.readFile(path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`), "utf8"));
      expect(trace.failure).toBe("");
    }
    expect(result.snapshot.day).toBe(size === 12 && alternate ? 3 : 2); expect(result.snapshot.phase).toBe("game_over");
    expect(result.snapshot.result).toEqual({ winner: "good", reason: "all_wolves_eliminated" });
    const manifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8"));
    expect(manifest.locale).toBe(locale); expect(manifest.players.map((row: any) => row.role)).toEqual(roles);
    const alive = size === 6 ? alternate ? [2, 3, 6] : [2, 6] : alternate ? [6, 8, 9, 10, 11, 12] : [5, 6, 8, 9, 10, 11, 12];
    expect(manifest.players.filter((row: any) => row.alive).map((row: any) => row.player_id)).toEqual(alive);
    const replay = JSON.parse(await fs.readFile(path.join(directory, "replay.json"), "utf8")); assertReplayDocument(replay); expect(replay.meta.locale).toBe(locale);
    const logic = JSON.parse(await fs.readFile(path.join(directory, "logic_ops.json"), "utf8")); expect(logic.ops.filter((op: any) => ["rejected", "fallback", "error"].includes(op.status))).toEqual([]);
    const views = await Promise.all(roles.map(async (_, index) => JSON.parse(await fs.readFile(path.join(directory, `players/player_${index + 1}.json`), "utf8"))));
    for (const view of views) {
      assertReplayPlayerView(view); expect(view.locale).toBe(locale);
      const rounds = view.timeline.filter((entry: any) => entry.kind === "turn"); expect(rounds).toHaveLength(plans.get(view.player_id)!.length);
      for (const round of rounds) {
        expect(round.delta_messages.some((message: any) => message.kind === "fallback" || message.kind === "request_error")).toBe(false);
        const prompt = round.delta_messages.find((message: any) => message.role === "user" && message.kind === "prompt")?.content;
        expect(prompt).toContain(locale === "en" ? "[Action prompt]" : "[行动提示]");
      }
    }
    if (kind === "llm") for (const [actor, plan] of actorPlans) expect(counts.get(actor)).toBe(plan.turns.length);
    else for (const [actor, plan] of actorPlans) {
      const trace = JSON.parse(await fs.readFile(path.join(directory, `acp-workspaces/player-${actor}/game-fixture.json`), "utf8"));
      if (plan.role === "seer") expect([...new Set(trace.visibleSeerTargets)]).toEqual(size === 6 ? [1, 4] : [1, 2]);
      expect(trace.locale).toBe(locale); expect(trace.initializationSeen).toBe(true); expect(trace.schemaChecked).toBe(true); expect(trace.consumed).toBe(plan.turns.length);
      for (const pid of [trace.agentPid, trace.mcpPid]) { expect(Number.isSafeInteger(pid) && pid > 0).toBe(true); try { process.kill(pid, 0); throw new Error("fixture_process_still_alive"); } catch (error) { expect((error as NodeJS.ErrnoException).code).toBe("ESRCH"); } }
    }
    if (kind === "llm") expect([...visibleSeerTargets.get(size === 6 ? 2 : 5)!]).toEqual(size === 6 ? [1, 4] : [1, 2]);
    const record = await readReproduction(path.join(directory, "reproduction.json"));
    for (const [actorId, plan] of actorPlans) {
      const decisions = record.decisions.filter(decision => decision.actorId === actorId);
      expect(decisions.map(decision => ({ day: decision.day, stage: decision.stage }))).toEqual(plan.turns.map(turn => ({ day: turn.day, stage: turn.stage })));
    }
    const output = await createTestTempDirectory("awa-full-transport-replayed-");
    expect((await replayReproduction(record, output)).snapshot).toEqual(result.snapshot);
    const summary = await fs.readFile(path.join(directory, "debug_summary.md"), "utf8");
    expect(summary).toContain(locale === "en" ? "## 对局" : "## Session");
    return { result, events: commonEvents(replay.events), record, views };
  } finally { server?.stop(true); }
}

for (const size of [6, 12] as const) for (const alternate of [false, true]) for (const kind of ["llm", "acp"] as const)
  test(`${size}/${alternate ? "alternate" : "standard"}/${kind}: full bilingual runner games and action replay preserve manual outcomes`, async () => {
    const zh = await runFixture(size, alternate, kind, "zh-CN");
    const en = await runFixture(size, alternate, kind, "en");
    expect(en.result).toEqual(zh.result); expect(en.events).toEqual(zh.events);
    expect(en.record.checkpoints.map(cp => ({ ...cp, players: cp.players }))).toEqual(zh.record.checkpoints);
    const neutralDecisions = (record: typeof en.record) => record.decisions.map(({ settleOrder: _settle, openedAfterSettlement: _opening, ...decision }) => decision);
    expect(neutralDecisions(en.record)).toEqual(neutralDecisions(zh.record));
  }, 120000);


test("simultaneous SDK games keep language, records, events and complete replay scoped to each game", async () => {
  const [zh, en] = await Promise.all([runFixture(6, false, "llm", "zh-CN"), runFixture(6, false, "llm", "en")]);
  expect(zh.events).toEqual(en.events); expect(zh.record.metadata.locale).toBe("zh-CN"); expect(en.record.metadata.locale).toBe("en");
  expect(zh.record.checkpoints).toEqual(en.record.checkpoints);
}, 120000);
