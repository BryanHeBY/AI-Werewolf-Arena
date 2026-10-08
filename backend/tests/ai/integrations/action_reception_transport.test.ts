import { expect, test } from "bun:test";
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
import { COMPONENT, Phase, Role, type ActionRequest, type RoleComponent } from "../../../src/core";
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
