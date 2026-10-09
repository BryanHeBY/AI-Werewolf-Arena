import { expect, spyOn, test } from "bun:test";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { runGame } from "../../src/runtime/game_runner";
import { readReproduction, replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import * as factory from "../../src/runtime/player_agent_factory";
import { BaselineBotActionProvider } from "../../src/ai/agents/providers/action_providers";
import { LlmActionProvider } from "../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../src/ai/agents/acp/acp_action_provider";
import { blackMarketScenario } from "../support/black_market_scenarios";
import { createTestTempDirectory } from "../support/temp_directory";

for (const transport of ["sdk", "acp"] as const) for (const locale of ["zh-CN", "en"] as const) test(`${transport}/${locale}: Black strict trade failure retains inventory, rejection evidence and exact partial Tape`, async () => {
  const scenario = blackMarketScenario("check_cross"), root = await createTestTempDirectory("awa-black-failure-"), output = await createTestTempDirectory("awa-black-failure-replay-");
  const runtime = parseRuntimeConfig({ providers: { default: "synthetic", items: { synthetic: { type: "openai", apiKey: "synthetic-only" } } }, agents: { default: "synthetic", items: { synthetic: { kind: "llm", provider: "synthetic", model: "synthetic" } } }, game: { board: scenario.board.definition.id, seed: scenario.seed, locale }, debugSummary: { agent: { enabled: false } } });
  const setup = resolveGameSetup(runtime, { recordRootDir: root, maxDays: 8, maxRuntimeMs: 10000, streamEvents: false, printThinking: false, color: false }, scenario.board);
  let fallbackCalls = 0;
  const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(async options => {
    const baseline = new BaselineBotActionProvider(options.world), fallbackProvider = { async getAction() { fallbackCalls++; return null; } };
    const client: any = { async chat() { throw new Error("unexpected_chat"); }, async runToolLoop(_m: any, _t: any, callbacks: any) {
      for (let i = 0; i < 3; i++) await callbacks.onToolCall({ name: "submit_action", args: { turn_id: "t1", action: "black_market_trade", arguments: { target_id: 3, skill: "gun" } } });
      return { finalAction: null, assistantText: "End" };
    } };
    const provider = transport === "sdk" ? new LlmActionProvider(options.world, client, { boardConfig: options.boardConfig, fallbackProvider }) : new AcpActionProvider(options.world, { boardConfig: options.boardConfig, fallbackProvider, sessionFactory: { async createSession(input) {
      return { sessionId: "failure-tape", async prompt() { for (let i = 0; i < 3; i++) input.registry.submitAction("failure-tape", { turn_id: "t1", action: "black_market_trade", arguments: { target_id: 3, skill: "gun" } }); }, async cancel() {}, async close() {} };
    } } });
    let closed = false;
    return { kind: transport === "sdk" ? "llm" : "acp", provider: { getAction(request) { return request.actorId === 3 && request.context.stage === "black_market_merchant" ? provider.getAction(request) : baseline.getAction(request); } }, get runtimeState() { return { closed }; }, async close() { closed = true; await provider.close(); } };
  });
  try {
    await expect(runGame(setup)).rejects.toThrow(); expect(fallbackCalls).toBe(0);
    const directory = path.join(root, (await readdir(root)).find(name => name.startsWith("session_"))!);
    const record = await readReproduction(path.join(directory, "reproduction.json")), failed = record.decisions.find(decision => decision.stage === "black_market_merchant")!;
    expect(failed.request.context.action_failure_policy).toBe("error"); expect(failed.outcome).toMatchObject({ kind: "error", code: "decision_failed" });
    expect(record.checkpoints.at(-1)!.complete).toBe(false); expect(record.events.some(event => event.type === "black_market_trade_skipped" || event.type === "black_market_trade_committed" || event.type === "black_market_trade_resolved")).toBe(false);
    const privateState = record.checkpoints.at(-1)!.players.find(player => player.id === 3)!.privateState.black_market_merchant as any;
    expect(privateState).toEqual({ remaining: 1, closedDay: null, choice: null });
    expect((await replayReproduction(record, output)).snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
    const altered = structuredClone(record); delete altered.decisions.find(decision => decision.stage === "black_market_merchant")!.request.context.action_failure_policy;
    await expect(replayReproduction(altered, output)).rejects.toThrow("reproduction_observation_mismatch");
    const view = JSON.parse(await readFile(path.join(directory, "players/player_3.json"), "utf8"));
    expect(view.timeline.some((entry: any) => entry.kind === "turn" && entry.delta_messages.some((message: any) => message.kind === "constraint_warning"))).toBe(true);
    expect(JSON.stringify(view)).toContain("turn_invalid_action_limit"); expect(JSON.stringify(view)).not.toContain("transport_error");
  } finally { create.mockRestore(); }
}, 10000);
