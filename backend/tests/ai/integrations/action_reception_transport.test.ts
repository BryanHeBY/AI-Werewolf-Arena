import { expect, test } from "bun:test";
import { text } from "@ai-werewolf-arena/game-text";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../src/ai/integrations/acp/werewolf_mcp_control";
import { AiSdkClient } from "../../../src/ai/integrations/llm/ai_sdk_client";
import { SdkGameToolLoop } from "../../../src/ai/agents/llm/sdk_game_tool_loop";
import { PlayerPromptSession } from "../../../src/ai/agents/llm/player_prompt_session";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import { LlmObserver } from "../../../src/ai/agents/player/player_observer";
import { getDefaultToolCallRepairRegistry, getDefaultToolSpecRegistry, getDefaultRoleCatalog, getDefaultTargetHintRegistry, getDefaultPhaseStageLocalizationRegistry, getDefaultConfigRenderRegistry } from "../../../src/game/mechanisms";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { COMPONENT, Camp, Phase, Role, type ActionRequest, type RoleComponent } from "../../../src/core";
import { getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import type { ChatModelClient, ToolLoopCallbacks, ToolLoopStepTrace } from "../../../src/ai/integrations/llm/transport";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../support/temp_directory";

const roles = [Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager, Role.Villager, Role.Villager];
const request: ActionRequest = { actorId: 6, phase: Phase.Night, allowedTools: ["use_potion"], context: { day: 1, stage: "witch", wolf_target: 9, visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } } };
function sdkLoop(world: ReturnType<typeof bootstrapGame>["world"], onTrace?: (trace: ToolLoopStepTrace[]) => void) {
  const policy = new PlayerPromptPolicy(world, { toolSpecRegistry: getDefaultToolSpecRegistry(), roleCatalog: getDefaultRoleCatalog(), targetHintRegistry: getDefaultTargetHintRegistry(), phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(), configRenderRegistry: getDefaultConfigRenderRegistry() });
  const observer = new LlmObserver({ trace: false, printLlmIo: false, printThinking: false });
  if (onTrace) observer.thinking = onTrace;
  return new SdkGameToolLoop(world, getDefaultToolCallRepairRegistry(), new PlayerPromptSession({ maxPromptEvents: 20, promptPolicy: policy }), observer);
}
const submissions = [
  { turn_id: "t99", action: "use_potion", arguments: { target_id: 6, potion_type: "none" } },
  { turn_id: "t1", action: "speak", arguments: { text: "wrong tool" } },
  { turn_id: "t1", action: "use_potion", arguments: { target_id: 9, potion_type: "heal", private_override: "synthetic-secret" } },
  { turn_id: "t1", action: "use_potion", arguments: { target_id: 6, potion_type: "heal" } },
  { turn_id: "t1", action: "use_potion", arguments: { target_id: 9, potion_type: "heal" } },
  { turn_id: "t1", action: "use_potion", arguments: { target_id: 999, potion_type: "poison" } },
  { turn_id: "t1", action: "use_potion", arguments: { target_id: 6, potion_type: "none" } },
  { turn_id: "t1", action: "use_potion", arguments: { target_id: 9, potion_type: "poison" } },
];
const staleReport = { turn_id: "t99", category: "state", severity: "high", message: "synthetic stale report" };
const expectedCodes = ["turn_id_mismatch", "turn_id_mismatch", "tool_not_allowed_in_this_turn", "invalid_tool_arguments", "self_heal", "heal_unavailable", "poison_target", "accepted", "turn_not_open_or_session_invalid"];

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: real SDK HTTP and injected MCP return identical business receipts; rejected calls remain open and preflight does not record domain operations`, async () => {
  const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
  const acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
  const sdkState = getWitchState(sdk.world.getComponent<RoleComponent>(6, COMPONENT.Role))!;
  const acpState = getWitchState(acp.world.getComponent<RoleComponent>(6, COMPONENT.Role))!;
  sdkState.heal = 0; acpState.heal = 0;
  const before = structuredClone(sdkState);
  let requests = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(input) {
    await input.json(); requests++;
    const actionCalls = (requests === 1 ? submissions.slice(0, 6) : submissions.slice(6)).map(args => ({ name: "submit_action", args }));
    const calls = requests === 1 ? [{ name: "report_bug", args: staleReport }, ...actionCalls] : actionCalls;
    return Response.json({ id: "synthetic-reception", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: calls.map(({ name, args }, index) => ({ id: `call-${requests}-${index}`, type: "function", function: { name, arguments: JSON.stringify(args) } })) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  } });
  const registry = new AcpTurnRegistry(acp.world), control = new WerewolfMcpControlServer(registry);
  const client = new Client({ name: "reception-test", version: "1.0.0" });
  const config = await control.start(process.execPath, [path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts")]);
  control.bindSession("same-session");
  const pending = registry.openTurn(request, "same-session");
  const record = await SessionRecordManager.create({ sessionId: `reception-${locale}`, board: "twelve_player_standard", locale, startedAtIso: new Date().toISOString() }, await createTestTempDirectory("awa-reception-"));
  try {
    await client.connect(new StdioClientTransport({ command: config.command, args: config.args, env: Object.fromEntries(config.env.map(item => [item.name, item.value])) }));
    await runWithSessionRecorder(record, async () => {
      const receivedSdk: unknown[] = [];
      const loop = sdkLoop(sdk.world, trace => receivedSdk.push(...trace.flatMap(step => step.toolCalls.map(call => JSON.parse(call.toolResult)))));
      const result = await loop.run(new AiSdkClient({ apiKey: "synthetic-only", baseURL: `${server.url.origin}/v1`, model: "synthetic" }), request, [{ role: "user", content: "Submit the current action." }], 2000, "t1");
      const receivedAcp = [(await client.callTool({ name: "report_bug", arguments: staleReport })).structuredContent];
      for (const args of submissions) receivedAcp.push((await client.callTool({ name: "submit_action", arguments: args })).structuredContent);
      expect(receivedSdk).toEqual(receivedAcp);
      expect(receivedAcp.map((receipt: any) => receipt.ok ? "accepted" : receipt.error)).toEqual(expectedCodes);
      expect(receivedAcp[7]).toEqual({ ok: true, accepted: true, applied: false, action: "use_potion" });
      expect(JSON.stringify(receivedAcp)).not.toContain("synthetic-secret");
      if (locale === "en") expect(JSON.stringify(receivedAcp)).not.toMatch(/\p{Script=Han}/u);
      expect(result.action).toEqual({ name: "use_potion", args: { target_id: 6, potion_type: "none" } });
      expect(await pending.action).toEqual(result.action);
      expect(sdkState).toEqual(before); expect(acpState).toEqual(before); expect(requests).toBe(2);
      expect(new ToolGateway().validateAndSanitize(sdk.world, 6, result.action!, { phase: Phase.Night }).ok).toBe(true);
    });
    await record.flushNow();
    const ops = JSON.parse(await readFile(path.join(record.sessionDir, "logic_ops.json"), "utf8")).ops;
    expect(ops.filter((op: any) => op.scope === "gateway" && op.op === "validate_tool_call")).toHaveLength(1);
  } finally { registry.close(); await client.close(); await control.close({ force: true }); server.stop(true); }
});

test("SDK owns its accepted action, rejects callbacks after completion/timeout, and ignores a fabricated transport finalAction", async () => {
  const game = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale: "en" });
  let callback!: ToolLoopCallbacks<import("../../../src/core").ToolCall>["onToolCall"];
  const submitted = { id: "synthetic", name: "submit_action", rawArgs: "{}", args: submissions[6] };
  const forgedClient = { chat: async () => "", async runToolLoop<T>(_messages: unknown, _tools: unknown, callbacks: any) { callback = callbacks.onToolCall; return { finalAction: { name: "use_potion", args: { target_id: 9, potion_type: "poison" } } as T, assistantText: "" }; } } as ChatModelClient;
  expect((await sdkLoop(game.world).run(forgedClient, request, [], 1000, "t1")).action).toBeNull();
  expect((await callback(submitted)).toolResult).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  const hanging = { chat: async () => "", async runToolLoop<T>(_messages: unknown, _tools: unknown, callbacks: any) { callback = callbacks.onToolCall; return new Promise<never>(() => {}); } } as ChatModelClient;
  await expect(sdkLoop(game.world).run(hanging, request, [], 30, "t1")).rejects.toThrow("llm_request_timeout_30ms");
  expect((await callback(submitted)).toolResult).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect((await callback({ id: "late-report", name: "report_bug", rawArgs: "{}", args: { turn_id: "t1", category: "state", severity: "high", message: "late synthetic report" } })).toolResult).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role))!.poison).toBe(1);
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: real SDK and MCP enforce wolf chat/knife permissions and phases before accepting a correction`, async () => {
  const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
  const acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
  let calls: Array<{ turn_id: string; action: string; arguments: Record<string, unknown> }> = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(input) {
    await input.json();
    return Response.json({ id: "wolf-permissions", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: calls.map((args, index) => ({ id: `call-${index}`, type: "function", function: { name: "submit_action", arguments: JSON.stringify(args) } })) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  } });
  const registry = new AcpTurnRegistry(acp.world), control = new WerewolfMcpControlServer(registry);
  const client = new Client({ name: "wolf-permission-test", version: "1.0.0" });
  const config = await control.start(process.execPath, [path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts")]);
  control.bindSession("wolf-permissions");
  const cases = [
    { actor: 9, phase: Phase.Night, action: "speak_to_wolves", args: { text: "unauthorized", end_chat: true }, error: "wolf_chat_permission" },
    { actor: 9, phase: Phase.Night, action: "kill_vote", args: { target_id: 1, abstain: false }, error: "wolf_kill_permission" },
    { actor: 1, phase: Phase.Day, action: "speak_to_wolves", args: { text: "wrong-phase", end_chat: true }, error: "wolf_chat_phase" },
    { actor: 1, phase: Phase.Day, action: "kill_vote", args: { target_id: 9, abstain: false }, error: "wolf_kill_phase" },
  ] as const;
  try {
    await client.connect(new StdioClientTransport({ command: config.command, args: config.args, env: Object.fromEntries(config.env.map(item => [item.name, item.value])) }));
    for (const item of cases) {
      // Deliberately overbroad engine input tests preflight's independent guard.
      const input: ActionRequest = { actorId: item.actor, phase: item.phase, allowedTools: [item.action, "speak"], context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } } };
      const pending = registry.openTurn(input, "wolf-permissions");
      calls = [{ turn_id: pending.turnId, action: item.action, arguments: item.args }, { turn_id: pending.turnId, action: "speak", arguments: { text: "corrected" } }];
      const receivedSdk: unknown[] = [];
      const result = await sdkLoop(sdk.world, trace => receivedSdk.push(...trace.flatMap(step => step.toolCalls.map(call => JSON.parse(call.toolResult))))).run(new AiSdkClient({ apiKey: "synthetic-only", baseURL: `${server.url.origin}/v1`, model: "synthetic" }), input, [{ role: "user", content: "Correct the rejected action." }], 2000, pending.turnId);
      const receivedAcp: unknown[] = [];
      for (const args of calls) receivedAcp.push((await client.callTool({ name: "submit_action", arguments: args })).structuredContent);
      expect(receivedSdk).toEqual(receivedAcp);
      expect(receivedAcp[0]).toMatchObject({ ok: false, error: item.error });
      expect(receivedAcp[1]).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
      expect(await pending.action).toEqual({ name: "speak", args: { text: "corrected" } });
      expect(result.action).toEqual(await pending.action);
      if (locale === "en") expect(JSON.stringify(receivedAcp)).not.toMatch(/\p{Script=Han}/u);
      registry.closeTurn("wolf-permissions");
    }
  } finally { registry.close(); await client.close(); await control.close({ force: true }); server.stop(true); }
});

for (const locale of ["zh-CN", "en"] as const) for (const action of ["speak_to_wolves", "kill_vote"] as const)
  test(`${locale}: SDK and ACP providers use the injected role catalog for prompts, reception and local fallback (${action})`, async () => {
    const { RoleCatalog } = await import("../../../src/game/mechanisms/roles/catalog");
    const { LlmActionProvider } = await import("../../../src/ai/agents/llm/llm_action_provider");
    const { AcpActionProvider } = await import("../../../src/ai/agents/acp/acp_action_provider");
    const { BaselineBotActionProvider } = await import("../../../src/ai/agents/providers/action_providers");
    const catalog = new RoleCatalog(getDefaultRoleCatalog().all().map(profile => profile.role !== Role.Wolf ? profile : { ...profile, wolfTeam: { recognizedByPack: false, recognizes: "none" as const, canChat: false, canVoteForKill: false } }));
    const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    const acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    const input: ActionRequest = { actorId: 1, phase: Phase.Night, allowedTools: [action, "speak"], context: { day: 1, stage: "wolf_discussion", visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } } };
    const badArgs = action === "kill_vote" ? { target_id: 9, abstain: false } : { text: "not-permitted", end_chat: true };
    const requests: any[] = [], receivedAcp: any[] = [];
    let acpInitialPrompt = "";
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(incoming) {
      requests.push(await incoming.json());
      const args = requests.length === 1 ? { turn_id: "t1", action, arguments: badArgs } : { turn_id: "t1", action: "speak", arguments: { text: "corrected" } };
      return Response.json({ id: "catalog", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: `call-${requests.length}`, type: "function", function: { name: "submit_action", arguments: JSON.stringify(args) } }] } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    } });
    let control: WerewolfMcpControlServer | undefined, client: Client | undefined;
    const sdkProvider = new LlmActionProvider(sdk.world, new AiSdkClient({ apiKey: "synthetic-only", baseURL: `${server.url.origin}/v1`, model: "synthetic" }), { roleCatalog: catalog, boardConfig: twelvePlayerStandardConfig, llmTimeoutMs: 2000 });
    const acpProvider = new AcpActionProvider(acp.world, { roleCatalog: catalog, boardConfig: twelvePlayerStandardConfig, turnTimeoutMs: 2000, sessionFactory: { async createSession(sessionInput) {
      acpInitialPrompt = sessionInput.initialPrompt ?? "";
      control = new WerewolfMcpControlServer(sessionInput.registry);
      const config = await control.start(process.execPath, [path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts")]);
      control.bindSession("catalog-session");
      client = new Client({ name: "catalog-test", version: "1.0.0" });
      await client.connect(new StdioClientTransport({ command: config.command, args: config.args, env: Object.fromEntries(config.env.map(item => [item.name, item.value])) }));
      return { sessionId: "catalog-session", async prompt(prompt) {
        const turn = /(?:Current turn ID: |当前回合 ID：)(t\d+)/.exec(prompt)![1];
        receivedAcp.push((await client!.callTool({ name: "submit_action", arguments: { turn_id: turn, action, arguments: badArgs } })).structuredContent);
        receivedAcp.push((await client!.callTool({ name: "submit_action", arguments: { turn_id: turn, action: "speak", arguments: { text: "corrected" } } })).structuredContent);
      }, async cancel() {}, async close() { await client!.close(); await control!.close({ force: true }); } };
    } } });
    try {
      expect(await sdkProvider.getAction(input)).toEqual({ name: "speak", args: { text: "corrected" } });
      expect(await acpProvider.getAction(input)).toEqual({ name: "speak", args: { text: "corrected" } });
      expect(requests).toHaveLength(2);
      const teammateHint = text(locale, "prompt.system.teammates", { teammates: text(locale, "common.none") });
      expect(requests[0].messages.find((message: any) => message.role === "system").content).toContain(teammateHint);
      expect(acpInitialPrompt).toContain(teammateHint);
      const receipt = requests[1].messages.filter((message: any) => message.role === "tool").map((message: any) => JSON.parse(message.content))[0];
      expect(receipt).toEqual(receivedAcp[0]); expect(receipt.error).toBe(action === "kill_vote" ? "wolf_kill_permission" : "wolf_chat_permission");
      expect(receivedAcp[1]).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
      expect(await new BaselineBotActionProvider(sdk.world, catalog).getAction({ ...input, allowedTools: [action] })).toBeNull();
      await sdkProvider.close(); await acpProvider.close();
      expect(sdkProvider.runtimeState.turns).toBe(0); expect(acpProvider.runtimeState.pool.sessions).toBe(0);
    } finally { await sdkProvider.close(); await acpProvider.close(); await client?.close(); await control?.close({ force: true }); server.stop(true); }
  });

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: reused SDK and ACP sessions receive updated authorized teammate knowledge every turn`, async () => {
  const { RoleCatalog } = await import("../../../src/game/mechanisms/roles/catalog");
  const { LlmActionProvider } = await import("../../../src/ai/agents/llm/llm_action_provider");
  const { AcpActionProvider } = await import("../../../src/ai/agents/acp/acp_action_provider");
  const catalog = new RoleCatalog(getDefaultRoleCatalog().all().map(profile => profile.role !== Role.Seer ? profile : { ...profile, wolfTeam: (state: RoleComponent) => ({ recognizedByPack: state.privateState.revealed === true, recognizes: "none" as const, canChat: false, canVoteForKill: false }) }));
  const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }), acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
  sdk.world.getComponent<RoleComponent>(5, COMPONENT.Role)!.camp = acp.world.getComponent<RoleComponent>(5, COMPONENT.Role)!.camp = Camp.Wolf;
  const input: ActionRequest = { actorId: 1, phase: Phase.Day, allowedTools: ["speak"], context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } } };
  const requests: any[] = [], acpPrompts: string[] = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(incoming) {
    requests.push(await incoming.json()); const turn = requests.length;
    return Response.json({ id: "knowledge", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: `call-${turn}`, type: "function", function: { name: "submit_action", arguments: JSON.stringify({ turn_id: `t${turn}`, action: "speak", arguments: { text: `turn-${turn}` } }) } }] } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  } });
  let control: WerewolfMcpControlServer | undefined, client: Client | undefined, creations = 0;
  const sdkProvider = new LlmActionProvider(sdk.world, new AiSdkClient({ apiKey: "synthetic-only", baseURL: `${server.url.origin}/v1`, model: "synthetic" }), { roleCatalog: catalog, boardConfig: twelvePlayerStandardConfig, llmTimeoutMs: 2000 });
  const acpProvider = new AcpActionProvider(acp.world, { roleCatalog: catalog, boardConfig: twelvePlayerStandardConfig, turnTimeoutMs: 2000, sessionFactory: { async createSession(sessionInput) {
    creations++; control = new WerewolfMcpControlServer(sessionInput.registry);
    const config = await control.start(process.execPath, [path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts")]);
    control.bindSession("knowledge-session"); client = new Client({ name: "knowledge-test", version: "1.0.0" });
    await client.connect(new StdioClientTransport({ command: config.command, args: config.args, env: Object.fromEntries(config.env.map(item => [item.name, item.value])) }));
    return { sessionId: "knowledge-session", async prompt(prompt) {
      acpPrompts.push(prompt); const turn = /(?:Current turn ID: |当前回合 ID：)(t\d+)/.exec(prompt)![1];
      const receipt = (await client!.callTool({ name: "submit_action", arguments: { turn_id: turn, action: "speak", arguments: { text: `turn-${acpPrompts.length}` } } })).structuredContent;
      expect(receipt).toMatchObject({ ok: true, accepted: true });
    }, async cancel() {}, async close() { await client!.close(); await control!.close({ force: true }); } };
  } } });
  try {
    for (const turn of [1, 2, 3]) {
      for (const game of [sdk, acp]) game.world.getComponent<RoleComponent>(5, COMPONENT.Role)!.privateState.revealed = turn === 2;
      expect(await sdkProvider.getAction(input)).toEqual({ name: "speak", args: { text: `turn-${turn}` } });
      expect(await acpProvider.getAction(input)).toEqual({ name: "speak", args: { text: `turn-${turn}` } });
      const hint = text(locale, "prompt.status.wolf_teammates", { teammates: turn === 2 ? "2, 3, 4, 5" : "2, 3, 4" });
      expect(requests[turn - 1].messages.filter((message: any) => message.role === "user").at(-1).content).toContain(hint);
      expect(acpPrompts[turn - 1]).toContain(hint);
    }
    expect(creations).toBe(1); expect(requests).toHaveLength(3);
    expect(requests[1].messages.find((message: any) => message.role === "system").content).toContain(text(locale, "prompt.system.teammates", { teammates: "2, 3, 4" }));
  } finally { await sdkProvider.close(); await acpProvider.close(); await client?.close(); await control?.close({ force: true }); server.stop(true); }
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: actual SDK/MCP reject non-knife heals, keep the turn open, and accept the correct marked target without consuming`, async () => {
  const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }), acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
  for (const game of [sdk, acp]) game.world.getComponent<{ add(mark: string): void }>(9, COMPONENT.StatusMarks)!.add("WolfKillMark");
  const actions = [{ turn_id: "t1", action: "use_potion", arguments: { target_id: 999, potion_type: "heal" } }, { turn_id: "t1", action: "use_potion", arguments: { target_id: 10, potion_type: "heal" } }, { turn_id: "t1", action: "use_potion", arguments: { target_id: 9, potion_type: "heal" } }];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(input) {
    await input.json();
    return Response.json({ id: "heal-target", object: "chat.completion", created: 1, model: "synthetic", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: actions.map((args, index) => ({ id: `call-${index}`, type: "function", function: { name: "submit_action", arguments: JSON.stringify(args) } })) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  } });
  const registry = new AcpTurnRegistry(acp.world), control = new WerewolfMcpControlServer(registry), client = new Client({ name: "heal-target", version: "1.0.0" });
  const config = await control.start(process.execPath, [path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts")]);
  control.bindSession("heal-target"); const pending = registry.openTurn(request, "heal-target");
  try {
    await client.connect(new StdioClientTransport({ command: config.command, args: config.args, env: Object.fromEntries(config.env.map(item => [item.name, item.value])) }));
    const receipts: unknown[] = [];
    const result = await sdkLoop(sdk.world, trace => receipts.push(...trace.flatMap(step => step.toolCalls.map(call => JSON.parse(call.toolResult))))).run(new AiSdkClient({ apiKey: "synthetic-only", baseURL: `${server.url.origin}/v1`, model: "synthetic" }), request, [{ role: "user", content: "Correct the rejected heal target." }], 2000, "t1");
    const mcp: any[] = [];
    for (const arguments_ of actions) mcp.push((await client.callTool({ name: "submit_action", arguments: arguments_ })).structuredContent);
    expect(receipts).toEqual(mcp); expect(mcp.map(receipt => receipt.ok ? "accepted" : receipt.error)).toEqual(["heal_target", "heal_target", "accepted"]);
    expect(result.action).toEqual({ name: "use_potion", args: { target_id: 9, potion_type: "heal" } }); expect(await pending.action).toEqual(result.action);
    expect(getWitchState(sdk.world.getComponent<RoleComponent>(6, COMPONENT.Role))!.heal).toBe(1);
    expect(getWitchState(acp.world.getComponent<RoleComponent>(6, COMPONENT.Role))!.heal).toBe(1);
    if (locale === "en") expect(JSON.stringify(mcp)).not.toMatch(/\p{Script=Han}/u);
  } finally { registry.close(); await client.close(); await control.close({ force: true }); server.stop(true); }
});
