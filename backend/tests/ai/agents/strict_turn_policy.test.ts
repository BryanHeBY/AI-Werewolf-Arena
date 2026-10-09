import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type ActionRequest, type RoleComponent } from "../../../src/core";
import { getGuardState } from "../../../src/game/mechanisms/roles/private_state";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { AiSdkClient } from "../../../src/ai/integrations/llm/ai_sdk_client";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { describeError } from "../../../src/utils/error_diagnostic";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../support/temp_directory";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];
const request = (strict: boolean): ActionRequest => ({ actorId: 5, phase: Phase.Night, allowedTools: ["guard"], context: { day: 1, stage: "guard", visible_events: [], turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 }, ...(strict ? { action_failure_policy: "error" } : {}) } });
for (const transport of ["sdk", "acp"] as const) for (const strict of [false, true]) test(`${transport}/${strict}: owned provider cancellation preserves default behavior and never fakes strict waiting`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
  let started!: () => void, finish!: () => void, closes = 0;
  const starting = new Promise<void>(resolve => { started = resolve; });
  const client: any = { async chat() { throw new Error("unexpected_chat"); }, async runToolLoop(_m: any, _t: any, _c: any, options: any) {
    started(); return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
  } };
  const provider = transport === "sdk" ? new LlmActionProvider(world, client, { llmTimeoutMs: 1500 }) : new AcpActionProvider(world, { turnTimeoutMs: 1500, sessionFactory: { async createSession() {
    return { sessionId: "cancel-policy", async prompt() { started(); await new Promise<void>(resolve => { finish = resolve; }); }, async cancel() { finish?.(); }, async close() { closes++; finish?.(); } };
  } } });
  const pending = provider.getAction(request(strict)).then(value => ({ value }), error => ({ error }));
  await starting; await expect(provider.close()).resolves.toBeUndefined();
  const result = await pending;
  if (strict) { expect("error" in result).toBe(true); if (!('error' in result)) throw new Error("expected_cancellation"); expect(describeError(result.error).code).toBe("request_aborted"); }
  else expect(result).toEqual({ value: null });
  expect(getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget).toBeNull();
  expect(provider.runtimeState.turns).toBe(0);
  if (transport === "acp") expect(closes).toBe(1);
});

for (const locale of ["zh-CN", "en"] as const) for (const malformed of ["json", "wrong_turn"] as const) test(`${locale}/${malformed}: production AiSdkClient parse/protocol failure cannot become a clean optional wait`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale });
  let requests = 0, fallbacks = 0;
  const syntheticFetch = Object.assign(async () => {
    requests++;
    const bad = requests <= 3, args = malformed === "json" ? "{bad_json" : JSON.stringify({ turn_id: "wrong-turn", action: "guard", arguments: { target_id: 6, abstain: false } });
    return Response.json({ id: "synthetic", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: bad ? "tool_calls" : "stop", message: bad ? { role: "assistant", content: null, tool_calls: [{ id: `invalid-${requests}`, type: "function", function: { name: "submit_action", arguments: args } }] } : { role: "assistant", content: "End" } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  }, { preconnect: fetch.preconnect });
  const provider = new LlmActionProvider(world, new AiSdkClient({ apiKey: "synthetic", baseURL: "https://synthetic.invalid/v1", model: "synthetic", fetch: syntheticFetch }), { llmTimeoutMs: 1500, fallbackProvider: { async getAction() { fallbacks++; return null; } } });
  try {
    await expect(provider.getAction(request(true))).rejects.toThrow("action_turn_failed");
    expect(requests).toBe(4); expect(fallbacks).toBe(0); expect(describeError(new Error("action_turn_failed"))).toEqual({ code: "action_failed" });
    expect(getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget).toBeNull();
  } finally { await provider.close(); }
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: required-turn retry domain rejection retains a no_valid_action reason instead of transport diagnostics`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale }); let attempts = 0;
  const client: any = { async chat() { throw new Error("unexpected_chat"); }, async runToolLoop(_m: any, _t: any, callbacks: any) {
    attempts++; if (attempts > 1) for (let i = 0; i < 3; i++) await callbacks.onToolCall({ name: "submit_action", args: { turn_id: "t1", action: "guard", arguments: { target_id: 999, abstain: false } } });
    return { finalAction: null, assistantText: "End" };
  } };
  const provider = new LlmActionProvider(world, client, { llmTimeoutMs: 1500 });
  const input = request(true); input.context.turn_constraints.min_valid_actions = 1;
  const manager = await SessionRecordManager.create({ sessionId: `strict-retry-${locale}`, board: "synthetic", locale, startedAtIso: new Date(0).toISOString() }, await createTestTempDirectory("awa-strict-retry-"));
  await runWithSessionRecorder(manager, async () => {
    await expect(provider.getAction(input)).rejects.toThrow("action_turn_failed"); await provider.close();
  });
  expect(attempts).toBe(2);
  const summary = await manager.finalize({ endedAtIso: new Date(1).toISOString(), winner: null, finishReason: "test", players: [] });
  const view = summary.playerViews.find(player => player.player_id === 5)!;
  expect(JSON.stringify(view)).toContain("turn_invalid_action_limit"); expect(JSON.stringify(view)).not.toContain("transport_error");
  expect(view.timeline.some(entry => entry.kind === "turn" && entry.delta_messages.some(message => message.kind === "constraint_warning"))).toBe(true);
});

for (const locale of ["zh-CN", "en"] as const) for (const helper of ["report_bug", "get_game_schema"] as const) test(`${locale}/${helper}: SDK helper parse errors do not become action attempts or forbid optional waiting`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale }); let requests = 0;
  const syntheticFetch = Object.assign(async () => {
    requests++; const bad = requests <= 3;
    return Response.json({ id: "synthetic", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: bad ? "tool_calls" : "stop", message: bad ? { role: "assistant", content: null, tool_calls: [{ id: `helper-${requests}`, type: "function", function: { name: helper, arguments: "{bad_json" } }] } : { role: "assistant", content: "Wait" } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  }, { preconnect: fetch.preconnect });
  const provider = new LlmActionProvider(world, new AiSdkClient({ apiKey: "synthetic", baseURL: "https://synthetic.invalid/v1", model: "synthetic", fetch: syntheticFetch }), { llmTimeoutMs: 1500 });
  try { expect(await provider.getAction(request(true))).toBeNull(); expect(requests).toBe(4); expect(getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget).toBeNull(); }
  finally { await provider.close(); }
});

for (const transport of ["sdk", "acp"] as const) test(`${transport}: a strict deadline cannot be returned as a wait or spend a resource`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles }); let finish!: () => void, fallbacks = 0;
  const client: any = { async chat() { throw new Error("unexpected_chat"); }, async runToolLoop(_m: any, _t: any, _c: any, options: any) {
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
  } };
  const fallbackProvider = { async getAction() { fallbacks++; return null; } };
  const provider = transport === "sdk" ? new LlmActionProvider(world, client, { llmTimeoutMs: 30, fallbackProvider }) : new AcpActionProvider(world, { turnTimeoutMs: 30, fallbackProvider, sessionFactory: { async createSession() {
    return { sessionId: "deadline-policy", async prompt() { await new Promise<void>(resolve => { finish = resolve; }); }, async cancel() { finish?.(); }, async close() { finish?.(); } };
  } } });
  try { await expect(provider.getAction(request(true))).rejects.toThrow("action_turn_failed"); expect(fallbacks).toBe(0); expect(getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget).toBeNull(); }
  finally { await provider.close(); }
});

test("strict cancellation does not swallow a real ACP cleanup error", async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
  let started!: () => void, finish!: () => void;
  const starting = new Promise<void>(resolve => { started = resolve; }), cleanupError = new Error("synthetic_cleanup_failure");
  const provider = new AcpActionProvider(world, { turnTimeoutMs: 1500, sessionFactory: { async createSession() {
    return { sessionId: "cleanup-policy", async prompt() { started(); await new Promise<void>(resolve => { finish = resolve; }); }, async cancel() { finish?.(); }, async close() { finish?.(); throw cleanupError; } };
  } } });
  const pending = provider.getAction(request(true)).then(value => ({ value }), error => ({ error })); await starting;
  const closeError = await provider.close().then(() => undefined, error => error);
  expect(closeError).toBeInstanceOf(AggregateError);
  const contains = (error: unknown): boolean => error === cleanupError || error instanceof AggregateError && error.errors.some(contains);
  expect(contains(closeError)).toBe(true);
  const result = await pending; expect("error" in result).toBe(true); expect(getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget).toBeNull();
});

for (const strict of [false, true]) test(`${strict}: synchronous SDK completion cannot hide an elapsed strict absolute deadline`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles });
  const input = request(strict); input.deadlineAtMs = Date.now() + 60;
  const client: any = { async chat() { throw new Error("unexpected_chat"); }, async runToolLoop() {
    while (Date.now() <= input.deadlineAtMs! + 5) { /* Simulate synchronous decoding before timers can dispatch. */ }
    return { finalAction: null, assistantText: "End" };
  } };
  const provider = new LlmActionProvider(world, client, { llmTimeoutMs: 1500 });
  try { if (strict) await expect(provider.getAction(input)).rejects.toThrow("action_turn_failed"); else expect(await provider.getAction(input)).toBeNull();
    expect(getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget).toBeNull(); }
  finally { await provider.close(); }
});

for (const transport of ["sdk", "acp"] as const) for (const selected of [false, true]) test(`${transport}/${selected}: synchronous recording after a timely model result cannot deliver a late strict result`, async () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles }); const input = request(true); input.deadlineAtMs = Date.now() + 60;
  const outcomes: any[] = [];
  const client: any = { async chat() { throw new Error("unexpected_chat"); }, async runToolLoop(_m: any, _t: any, callbacks: any) {
    if (selected) await callbacks.onToolCall({ name: "submit_action", args: { turn_id: "t1", action: "guard", arguments: { target_id: 6, abstain: false } } });
    return { finalAction: null, assistantText: "End" };
  } };
  const provider = transport === "sdk" ? new LlmActionProvider(world, client, { llmTimeoutMs: 1500 }) : new AcpActionProvider(world, { turnTimeoutMs: 1500, sessionFactory: { async createSession(session) {
    return { sessionId: "late-record", async prompt() { if (selected) session.registry.submitAction("late-record", { turn_id: "t1", action: "guard", arguments: { target_id: 6, abstain: false } }); }, async cancel() {}, async close() {} };
  } } });
  const recorder = transport === "sdk" ? (provider as any).orchestrator.options.recorder : (provider as any).roundRecorder;
  recorder.record = (_request: any, _prompt: any, outcome: any) => { outcomes.push(outcome); while (Date.now() <= input.deadlineAtMs! + 5) { /* Slow synchronous persistence/serialization. */ } };
  try { await expect(provider.getAction(input)).rejects.toThrow("action_turn_failed"); expect(getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget).toBeNull();
    expect(outcomes.some(outcome => outcome.retryTrace?.some((trace: any) => trace.reason === "request_timeout" && trace.diagnostic?.code === "request_timeout"))).toBe(true); }
  finally { await provider.close(); }
});
